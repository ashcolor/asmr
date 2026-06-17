// US ANSI 配列のキーボードレイアウト定義。
// code は KeyboardEvent.code に対応させ、物理キー入力と画面キーを紐付ける。
// width はキー幅の倍率（1 = 標準キー1個分）。

export interface KeyDef {
  code: string; // KeyboardEvent.code
  label: string; // 通常時の表示
  shiftLabel?: string; // Shift 時の表示（数字記号など）
  width?: number; // キー幅倍率（省略時 1）
  flex?: boolean; // 余白を吸って伸びるキー（Space 用）
}

export type KeyboardRow = KeyDef[];

export const KEYBOARD_LAYOUT: KeyboardRow[] = [
  [
    { code: "Backquote", label: "`", shiftLabel: "~" },
    { code: "Digit1", label: "1", shiftLabel: "!" },
    { code: "Digit2", label: "2", shiftLabel: "@" },
    { code: "Digit3", label: "3", shiftLabel: "#" },
    { code: "Digit4", label: "4", shiftLabel: "$" },
    { code: "Digit5", label: "5", shiftLabel: "%" },
    { code: "Digit6", label: "6", shiftLabel: "^" },
    { code: "Digit7", label: "7", shiftLabel: "&" },
    { code: "Digit8", label: "8", shiftLabel: "*" },
    { code: "Digit9", label: "9", shiftLabel: "(" },
    { code: "Digit0", label: "0", shiftLabel: ")" },
    { code: "Minus", label: "-", shiftLabel: "_" },
    { code: "Equal", label: "=", shiftLabel: "+" },
    { code: "Backspace", label: "Backspace", width: 2 },
  ],
  [
    { code: "Tab", label: "Tab", width: 1.5 },
    { code: "KeyQ", label: "Q" },
    { code: "KeyW", label: "W" },
    { code: "KeyE", label: "E" },
    { code: "KeyR", label: "R" },
    { code: "KeyT", label: "T" },
    { code: "KeyY", label: "Y" },
    { code: "KeyU", label: "U" },
    { code: "KeyI", label: "I" },
    { code: "KeyO", label: "O" },
    { code: "KeyP", label: "P" },
    { code: "BracketLeft", label: "[", shiftLabel: "{" },
    { code: "BracketRight", label: "]", shiftLabel: "}" },
    { code: "Backslash", label: "\\", shiftLabel: "|", width: 1.5 },
  ],
  [
    { code: "CapsLock", label: "Caps", width: 1.75 },
    { code: "KeyA", label: "A" },
    { code: "KeyS", label: "S" },
    { code: "KeyD", label: "D" },
    { code: "KeyF", label: "F" },
    { code: "KeyG", label: "G" },
    { code: "KeyH", label: "H" },
    { code: "KeyJ", label: "J" },
    { code: "KeyK", label: "K" },
    { code: "KeyL", label: "L" },
    { code: "Semicolon", label: ";", shiftLabel: ":" },
    { code: "Quote", label: "'", shiftLabel: '"' },
    { code: "Enter", label: "Enter", width: 2.25 },
  ],
  [
    { code: "ShiftLeft", label: "Shift", width: 2.25 },
    { code: "KeyZ", label: "Z" },
    { code: "KeyX", label: "X" },
    { code: "KeyC", label: "C" },
    { code: "KeyV", label: "V" },
    { code: "KeyB", label: "B" },
    { code: "KeyN", label: "N" },
    { code: "KeyM", label: "M" },
    { code: "Comma", label: ",", shiftLabel: "<" },
    { code: "Period", label: ".", shiftLabel: ">" },
    { code: "Slash", label: "/", shiftLabel: "?" },
    { code: "ShiftRight", label: "Shift", width: 2.75 },
  ],
  [
    { code: "ControlLeft", label: "Ctrl", width: 1.5 },
    { code: "MetaLeft", label: "Win", width: 1.25 },
    { code: "AltLeft", label: "Alt", width: 1.25 },
    { code: "Space", label: "", flex: true },
    { code: "AltRight", label: "Alt", width: 1.25 },
    { code: "MetaRight", label: "Win", width: 1.25 },
    { code: "ControlRight", label: "Ctrl", width: 1.5 },
  ],
];

// 入力文字（key）→ KeyboardEvent.code の対応表。
// 自動打鍵モードやクリック時のハイライト用に、文字からキーを引けるようにする。
const CHAR_TO_CODE: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const row of KEYBOARD_LAYOUT) {
    for (const key of row) {
      if (key.label.length === 1) {
        map[key.label.toLowerCase()] = key.code;
      }
      if (key.shiftLabel && key.shiftLabel.length === 1) {
        map[key.shiftLabel] = key.code;
      }
    }
  }
  map[" "] = "Space";
  map["\n"] = "Enter";
  return map;
})();

// 1 文字から対応する KeyboardEvent.code を返す（無ければ undefined）。
export function codeForChar(ch: string): string | undefined {
  return CHAR_TO_CODE[ch] ?? CHAR_TO_CODE[ch.toLowerCase()];
}
