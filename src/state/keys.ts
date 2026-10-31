/** Keys Edboard keeps for itself: Escape is the panic "stop everything" key. */
export const STOP_ALL_KEY = 'Escape'

const UNBINDABLE = new Set([
  STOP_ALL_KEY,
  'Tab',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'ContextMenu',
  'Fn',
  'FnLock',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
])

/** Whether a physical key can be used as a pad shortcut. */
export function isBindable(code: string): boolean {
  return code !== '' && code !== 'Unidentified' && !UNBINDABLE.has(code)
}

const NAMED: Record<string, string> = {
  Space: 'SPACE',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  IntlBackslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
  Enter: 'ENTER',
  Backspace: 'BKSP',
  Delete: 'DEL',
  Insert: 'INS',
  Home: 'HOME',
  End: 'END',
  PageUp: 'PGUP',
  PageDown: 'PGDN',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  NumpadAdd: 'NUM+',
  NumpadSubtract: 'NUM-',
  NumpadMultiply: 'NUM*',
  NumpadDivide: 'NUM/',
  NumpadDecimal: 'NUM.',
  NumpadEnter: 'NUM⏎',
  NumpadEqual: 'NUM=',
  Pause: 'PAUSE',
  PrintScreen: 'PRTSC',
}

let layoutMap: ReadonlyMap<string, string> | null = null

/**
 * On browsers that expose the Keyboard Map API, learn the user's layout so
 * shortcut labels match their keycaps (e.g. AZERTY shows "A" for KeyQ).
 */
export async function loadKeyboardLayout(): Promise<boolean> {
  const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> } })
    .keyboard
  if (!keyboard?.getLayoutMap) return false
  try {
    layoutMap = await keyboard.getLayoutMap()
    return true
  } catch {
    return false
  }
}

/** Short keycap label for a `KeyboardEvent.code`. */
export function keyLabel(code: string): string {
  const fromLayout = layoutMap?.get(code)
  if (fromLayout && fromLayout.trim() && (code.startsWith('Key') || code.startsWith('Digit') || code in NAMED)) {
    return fromLayout.toUpperCase()
  }
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  const numpad = /^Numpad(\d)$/.exec(code)
  if (numpad) return `NUM${numpad[1]}`
  if (/^F\d{1,2}$/.test(code)) return code
  return NAMED[code] ?? code.replace(/(Left|Right)$/, '').toUpperCase().slice(0, 6)
}

/** True when a key event should be left to the browser / a text field. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset'].includes(target.type)
  }
  return false
}
