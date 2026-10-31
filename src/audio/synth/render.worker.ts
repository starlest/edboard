/// Web Worker that renders built-in sounds off the main thread.
import { getBuiltin } from './library.ts'
import { renderBuiltin } from './render.ts'

export interface RenderRequest {
  id: string
  sampleRate: number
}

export type RenderResponse =
  | { ok: true; id: string; sampleRate: number; left: Float32Array; right: Float32Array }
  | { ok: false; id: string; error: string }

self.onmessage = (event: MessageEvent<RenderRequest>) => {
  const { id, sampleRate } = event.data
  const sound = getBuiltin(id)
  if (!sound) {
    self.postMessage({ ok: false, id, error: `Unknown sound "${id}"` } satisfies RenderResponse)
    return
  }
  try {
    const { left, right } = renderBuiltin(sound, sampleRate)
    const response: RenderResponse = { ok: true, id, sampleRate, left, right }
    self.postMessage(response, { transfer: [left.buffer, right.buffer] })
  } catch (error) {
    self.postMessage({ ok: false, id, error: String(error) } satisfies RenderResponse)
  }
}
