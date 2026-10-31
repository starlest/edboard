import { getBuiltin } from './synth/library.ts'
import { renderBuiltin, type RenderedSound } from './synth/render.ts'
import type { RenderRequest, RenderResponse } from './synth/render.worker.ts'

export interface RenderCallbacks {
  onRendered(sound: RenderedSound): void
  onError(id: string, message: string): void
}

/**
 * Renders built-in sounds on a small pool of Web Workers, in priority order,
 * so the UI stays responsive at start-up. Falls back to the main thread
 * (yielding between sounds) if workers are unavailable.
 */
export class BuiltinRenderer {
  private readonly sampleRate: number
  private readonly callbacks: RenderCallbacks
  private readonly queue: string[] = []
  private readonly busy = new Map<Worker, string>()
  private idle: Worker[] = []
  private useWorkers = typeof Worker !== 'undefined'
  private mainThreadRunning = false

  constructor(sampleRate: number, callbacks: RenderCallbacks) {
    this.sampleRate = sampleRate
    this.callbacks = callbacks
  }

  /** Adds sounds to the end of the queue (ids already queued or rendering are ignored). */
  enqueue(ids: readonly string[]): void {
    const inFlight = new Set(this.busy.values())
    for (const id of ids) if (!this.queue.includes(id) && !inFlight.has(id)) this.queue.push(id)
    this.pump()
  }

  private spawnWorkers(): void {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2
    const count = Math.max(1, Math.min(4, cores - 1, this.queue.length))
    try {
      for (let i = this.idle.length + this.busy.size; i < count; i++) {
        const worker = new Worker(new URL('./synth/render.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = (event: MessageEvent<RenderResponse>) => this.handleResponse(worker, event.data)
        worker.onerror = (event) => {
          event.preventDefault()
          this.abandonWorkers()
        }
        this.idle.push(worker)
      }
    } catch {
      this.abandonWorkers()
    }
  }

  private handleResponse(worker: Worker, response: RenderResponse): void {
    this.busy.delete(worker)
    this.idle.push(worker)
    if (response.ok) {
      this.callbacks.onRendered({ id: response.id, sampleRate: response.sampleRate, left: response.left, right: response.right })
    } else {
      this.callbacks.onError(response.id, response.error)
    }
    this.pump()
  }

  /** Workers failed (e.g. blocked by CSP): put their jobs back and render on the main thread. */
  private abandonWorkers(): void {
    this.useWorkers = false
    for (const [worker, id] of this.busy) {
      this.queue.unshift(id)
      worker.terminate()
    }
    for (const worker of this.idle) worker.terminate()
    this.busy.clear()
    this.idle = []
    this.pump()
  }

  private pump(): void {
    if (!this.useWorkers) {
      this.runOnMainThread()
      return
    }
    if (this.queue.length > 0 && this.idle.length === 0 && this.busy.size === 0) this.spawnWorkers()
    while (this.useWorkers && this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!
      const id = this.queue.shift()!
      this.busy.set(worker, id)
      worker.postMessage({ id, sampleRate: this.sampleRate } satisfies RenderRequest)
    }
    if (this.queue.length === 0 && this.busy.size === 0) {
      // All done: free the workers' memory.
      for (const worker of this.idle) worker.terminate()
      this.idle = []
    }
  }

  private runOnMainThread(): void {
    if (this.mainThreadRunning) return
    this.mainThreadRunning = true
    const step = () => {
      const id = this.queue.shift()
      if (id === undefined) {
        this.mainThreadRunning = false
        return
      }
      const sound = getBuiltin(id)
      if (sound) {
        try {
          this.callbacks.onRendered(renderBuiltin(sound, this.sampleRate))
        } catch (error) {
          this.callbacks.onError(id, String(error))
        }
      } else {
        this.callbacks.onError(id, `Unknown sound "${id}"`)
      }
      setTimeout(step, 0)
    }
    setTimeout(step, 0)
  }

  dispose(): void {
    this.queue.length = 0
    for (const worker of [...this.idle, ...this.busy.keys()]) worker.terminate()
    this.idle = []
    this.busy.clear()
  }
}
