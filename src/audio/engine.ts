/**
 * Live playback: one AudioBufferSourceNode per voice, summed into a bus with
 * an echo send, a master gain, a limiter and stereo level meters.
 *
 *   voice ─▶ bus ─┬──────────────────────────▶ master ─▶ limiter ─▶ output ─▶ speakers
 *                 └▶ echo send ─▶ delay ⇄ fb ─┘                     └▶ meters (L/R)
 */

export type EngineEvent = { type: 'pad'; pad: number } | { type: 'state'; state: AudioContextState }

export interface PlayRequest {
  pad: number
  buffer: AudioBuffer
  /** Linear gain: pad volume × loudness levelling (× velocity). */
  gain: number
  loop: boolean
  /** Seconds of leading silence to skip. */
  offset?: number
}

interface Voice {
  pad: number
  source: AudioBufferSourceNode
  amp: GainNode
  duration: number
  loop: boolean
  startedAt: number
  /** Playback position (s, unwrapped) at `anchorTime`, for vari-speed aware progress. */
  anchorPos: number
  anchorTime: number
  rate: number
  stopping: boolean
}

type AudioContextWithSink = AudioContext & { setSinkId?: (sinkId: string) => Promise<void> }

const LIMITER = { threshold: -3, knee: 0, ratio: 20, attack: 0.002, release: 0.15 }
/** Web Audio compressors add automatic make-up gain; undo it so the limiter only limits. */
const LIMITER_TRIM = (() => {
  const { threshold, ratio } = LIMITER
  const fullRangeDb = threshold - threshold / ratio
  return Math.pow(Math.pow(10, fullRangeDb / 20), 0.6)
})()

const ATTACK = 0.004
const ECHO_TIME = 0.32

export class AudioEngine {
  readonly context: AudioContextWithSink
  private readonly bus: GainNode
  private readonly master: GainNode
  private readonly limiter: DynamicsCompressorNode
  private readonly limiterTrim: GainNode
  private readonly output: GainNode
  private readonly echoSend: GainNode
  private readonly analysers: readonly [AnalyserNode, AnalyserNode]
  private readonly meterData: Float32Array<ArrayBuffer>
  private readonly voices = new Map<number, Set<Voice>>()
  private readonly listeners = new Set<(event: EngineEvent) => void>()
  private rate = 1
  private limiterOn = true

  constructor() {
    const ctx: AudioContextWithSink = new AudioContext({ latencyHint: 'interactive' })
    this.context = ctx
    this.bus = new GainNode(ctx)
    this.master = new GainNode(ctx, { gain: 0.64 })
    this.limiter = new DynamicsCompressorNode(ctx, LIMITER)
    this.limiterTrim = new GainNode(ctx, { gain: LIMITER_TRIM })
    this.output = new GainNode(ctx)

    this.echoSend = new GainNode(ctx, { gain: 0 })
    const delay = new DelayNode(ctx, { delayTime: ECHO_TIME, maxDelayTime: 1 })
    const tone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 3200, Q: 0.5 })
    const thin = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 180 })
    const feedback = new GainNode(ctx, { gain: 0.42 })
    this.bus.connect(this.echoSend).connect(delay).connect(tone).connect(thin)
    thin.connect(feedback).connect(delay)
    thin.connect(this.master)

    this.bus.connect(this.master)
    this.master.connect(this.limiter).connect(this.limiterTrim).connect(this.output)
    this.output.connect(ctx.destination)

    const splitter = new ChannelSplitterNode(ctx, { numberOfOutputs: 2 })
    this.analysers = [new AnalyserNode(ctx, { fftSize: 1024 }), new AnalyserNode(ctx, { fftSize: 1024 })]
    this.meterData = new Float32Array(1024)
    this.output.connect(splitter)
    splitter.connect(this.analysers[0], 0)
    splitter.connect(this.analysers[1], 1)

    ctx.addEventListener('statechange', () => this.emit({ type: 'state', state: ctx.state }))
  }

  get state(): AudioContextState {
    return this.context.state
  }

  get sampleRate(): number {
    return this.context.sampleRate
  }

  /** Browsers start audio suspended until a user gesture; call this from input handlers. */
  resume(): void {
    if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined)
  }

  subscribe(listener: (event: EngineEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(event: EngineEvent): void {
    for (const listener of [...this.listeners]) listener(event)
  }

  play(request: PlayRequest): void {
    const ctx = this.context
    const now = ctx.currentTime
    const { buffer, pad, loop } = request
    const offset = Math.min(Math.max(0, request.offset ?? 0), Math.max(0, buffer.duration - 0.005))
    const source = new AudioBufferSourceNode(ctx, { buffer, loop, playbackRate: this.rate })
    if (loop) {
      source.loopStart = offset
      source.loopEnd = buffer.duration
    }
    const amp = new GainNode(ctx, { gain: 0 })
    amp.gain.setValueAtTime(0, now)
    amp.gain.linearRampToValueAtTime(Math.max(0, request.gain), now + ATTACK)
    source.connect(amp).connect(this.bus)
    source.start(now, offset)

    const voice: Voice = {
      pad,
      source,
      amp,
      duration: buffer.duration - offset,
      loop,
      startedAt: now,
      anchorPos: 0,
      anchorTime: now,
      rate: this.rate,
      stopping: false,
    }
    source.onended = () => this.finish(voice)
    let set = this.voices.get(pad)
    if (!set) {
      set = new Set()
      this.voices.set(pad, set)
    }
    set.add(voice)
    this.emit({ type: 'pad', pad })
  }

  private finish(voice: Voice): void {
    const set = this.voices.get(voice.pad)
    if (!set?.delete(voice)) return
    if (set.size === 0) this.voices.delete(voice.pad)
    voice.source.disconnect()
    voice.amp.disconnect()
    this.emit({ type: 'pad', pad: voice.pad })
  }

  private release(voice: Voice, fade: number): void {
    if (voice.stopping) return
    voice.stopping = true
    const now = this.context.currentTime
    const gain = voice.amp.gain
    if (typeof gain.cancelAndHoldAtTime === 'function') {
      gain.cancelAndHoldAtTime(now)
    } else {
      gain.cancelScheduledValues(now)
      gain.setValueAtTime(gain.value, now)
    }
    gain.linearRampToValueAtTime(0, now + fade)
    try {
      voice.source.stop(now + fade + 0.005)
    } catch {
      // Source already stopped.
    }
    this.emit({ type: 'pad', pad: voice.pad })
  }

  /** Fades out every voice of a pad. */
  stopPad(pad: number, fade = 0.03): void {
    for (const voice of this.voices.get(pad) ?? []) this.release(voice, fade)
  }

  stopAll(fade = 0.06): void {
    for (const set of this.voices.values()) for (const voice of set) this.release(voice, fade)
  }

  /** Cuts every pad except `pad` (solo / "one sound at a time" mode). */
  stopOthers(pad: number, fade = 0.04): void {
    for (const [other, set] of this.voices) if (other !== pad) for (const voice of set) this.release(voice, fade)
  }

  /** True while the pad has a voice that is not fading out. */
  isPlaying(pad: number): boolean {
    for (const voice of this.voices.get(pad) ?? []) if (!voice.stopping) return true
    return false
  }

  private rawPosition(voice: Voice, now: number): number {
    return voice.anchorPos + Math.max(0, now - voice.anchorTime) * voice.rate
  }

  /** Playback progress (0 – 1) of the pad's newest sounding voice, or null when silent. */
  progress(pad: number): number | null {
    let newest: Voice | null = null
    for (const voice of this.voices.get(pad) ?? []) {
      if (!voice.stopping && (!newest || voice.startedAt >= newest.startedAt)) newest = voice
    }
    if (!newest) return null
    if (newest.duration <= 0) return 1
    const raw = this.rawPosition(newest, this.context.currentTime)
    const position = newest.loop ? raw % newest.duration : Math.min(raw, newest.duration)
    return position / newest.duration
  }

  /** Master knob position 0 – 1, with an audio taper. */
  setMasterVolume(knob: number): void {
    const gain = Math.max(0, Math.min(1, knob)) ** 2
    this.master.gain.setTargetAtTime(gain, this.context.currentTime, 0.015)
  }

  /** Global vari-speed in semitones (changes pitch and speed, like a turntable). */
  setPitch(semitones: number): void {
    const rate = Math.pow(2, semitones / 12)
    if (rate === this.rate) return
    const now = this.context.currentTime
    for (const set of this.voices.values()) {
      for (const voice of set) {
        voice.anchorPos = this.rawPosition(voice, now)
        voice.anchorTime = now
        voice.rate = rate
        voice.source.playbackRate.setValueAtTime(rate, now)
      }
    }
    this.rate = rate
  }

  /** Echo amount 0 – 1. */
  setEcho(amount: number): void {
    this.echoSend.gain.setTargetAtTime(Math.max(0, Math.min(1, amount)) * 0.75, this.context.currentTime, 0.03)
  }

  setLimiter(enabled: boolean): void {
    if (enabled === this.limiterOn) return
    this.limiterOn = enabled
    this.master.disconnect()
    if (enabled) this.master.connect(this.limiter)
    else this.master.connect(this.output)
  }

  /** Whether the browser can route audio to a specific output device. */
  get canSelectOutput(): boolean {
    return typeof this.context.setSinkId === 'function'
  }

  async setOutputDevice(deviceId: string): Promise<boolean> {
    if (typeof this.context.setSinkId !== 'function') return false
    try {
      await this.context.setSinkId(deviceId)
      return true
    } catch {
      return false
    }
  }

  /** Peak output level per channel (linear), written into `out`. */
  readLevels(out: [number, number]): void {
    for (let ch = 0; ch < 2; ch++) {
      this.analysers[ch].getFloatTimeDomainData(this.meterData)
      let peak = 0
      for (let i = 0; i < this.meterData.length; i++) {
        const v = Math.abs(this.meterData[i])
        if (v > peak) peak = v
      }
      out[ch] = peak
    }
  }
}
