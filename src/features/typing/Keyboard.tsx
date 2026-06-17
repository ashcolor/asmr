// 2D の HTML キーボード。押下中のキー(code)をハイライトし、
// クリック/タップで onKeyTap を返す。物理キー入力の検知は親(TypingScene)が担当。
import { KEYBOARD_LAYOUT } from "./keyboardLayout";
import type { KeyDef } from "./keyboardLayout";

interface KeyboardProps {
  // 押下中のキー（KeyboardEvent.code）。ハイライト表示に使う。
  pressed: Set<string>;
  // 画面キーのクリック/タップ時に呼ばれる。
  onKeyTap: (key: KeyDef) => void;
}

export default function Keyboard({ pressed, onKeyTap }: KeyboardProps) {
  return (
    <div className="kb" aria-hidden>
      {KEYBOARD_LAYOUT.map((row, ri) => (
        <div className="kb__row" key={ri}>
          {row.map((key) => {
            const isPressed = pressed.has(key.code);
            const cls =
              "kb__key" +
              (key.flex ? " kb__key--flex" : "") +
              (isPressed ? " kb__key--active" : "");
            return (
              <button
                type="button"
                key={key.code}
                className={cls}
                style={key.width && !key.flex ? { flexGrow: key.width, flexBasis: 0 } : undefined}
                // mousedown / touchstart 相当で即座に鳴らす（click だと離した時になる）。
                onPointerDown={(e) => {
                  e.preventDefault();
                  onKeyTap(key);
                }}
                tabIndex={-1}
              >
                {key.shiftLabel ? (
                  <>
                    <span className="kb__key-shift">{key.shiftLabel}</span>
                    <span className="kb__key-main">{key.label}</span>
                  </>
                ) : (
                  <span className="kb__key-main">{key.label}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
