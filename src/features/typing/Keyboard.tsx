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
    <div
      className="flex w-full select-none flex-col gap-1 rounded-box bg-base-200 p-3 shadow-xl sm:gap-2 sm:p-4"
      aria-hidden
    >
      {KEYBOARD_LAYOUT.map((row, ri) => (
        <div className="flex gap-1 sm:gap-2" key={ri}>
          {row.map((key) => {
            const isPressed = pressed.has(key.code);
            const cls =
              "btn min-h-0 min-w-0 flex-1 basis-0 flex-col gap-0 px-1 text-xs font-normal sm:h-14 sm:text-sm" +
              (key.flex ? " flex-[8]" : " h-11") +
              (isPressed ? " btn-primary" : " btn-neutral");
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
                    <span className="text-[0.7em] leading-none text-neutral-content/70">
                      {key.shiftLabel}
                    </span>
                    <span className="leading-none">{key.label}</span>
                  </>
                ) : (
                  <span className="leading-none">{key.label}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
