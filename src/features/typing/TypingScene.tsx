// キーボードタイピング ASMR シーン。
// 画面中央に大きな 2D キーボードを表示し、その下にサンプルテキスト/入力欄を置く。
// 物理キー入力と画面キーのクリック/タップの両方で、選択したキースイッチの打鍵音が鳴る。
import { useCallback, useEffect, useRef, useState } from "react";
import Keyboard from "./Keyboard";
import { codeForChar } from "./keyboardLayout";
import type { KeyDef } from "./keyboardLayout";
import { KEY_SWITCHES, loadKeySwitch, playKeySwitch } from "../../audio/audio";
import { randomSample } from "./sampleTexts";

// 自動打鍵の 1 文字あたりの基準間隔(ms)。人間らしくゆらぎを足す。
// 実際の間隔はこれを速度倍率で割って決める（倍率が大きいほど速い）。
const AUTO_TYPE_BASE_MS = 140;

// 自動打鍵の速度倍率の範囲。1=標準、小さいほどゆっくり、大きいほど速い。
const AUTO_SPEED_MIN = 0.4;
const AUTO_SPEED_MAX = 3;

export default function TypingScene() {
  // 選択中のキースイッチ（既定: 赤軸）。
  const [switchId, setSwitchId] = useState<string>(KEY_SWITCHES[0].id);
  // 音量(0..1)。
  const [volume, setVolume] = useState(0.9);
  // 押下中のキー(code)。ハイライト用。
  const [pressed, setPressed] = useState<Set<string>>(() => new Set());
  // 自由入力モードのテキスト。
  const [text, setText] = useState("");
  // 自動打鍵モードの ON/OFF。
  const [autoTyping, setAutoTyping] = useState(false);
  // 自動打鍵の速度倍率（1=標準）。
  const [autoSpeed, setAutoSpeed] = useState(1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 自動打鍵のタイマーID。
  const autoTimerRef = useRef<number | null>(null);

  // 最新値を effect 内から参照するための ref（依存配列を膨らませないため）。
  const switchIdRef = useRef(switchId);
  const volumeRef = useRef(volume);
  const autoSpeedRef = useRef(autoSpeed);
  switchIdRef.current = switchId;
  volumeRef.current = volume;
  autoSpeedRef.current = autoSpeed;

  // スイッチが変わったらサンプルを先読みしておく（初回・切替時）。
  useEffect(() => {
    loadKeySwitch(switchId);
  }, [switchId]);

  // 打鍵音を鳴らす共通処理。
  const hit = useCallback(() => {
    playKeySwitch(switchIdRef.current, volumeRef.current);
  }, []);

  // 画面キーのクリック/タップ。短くハイライトしてから消す。
  const handleKeyTap = useCallback(
    (key: KeyDef) => {
      hit();
      setPressed((prev) => {
        const next = new Set(prev);
        next.add(key.code);
        return next;
      });
      window.setTimeout(() => {
        setPressed((prev) => {
          const next = new Set(prev);
          next.delete(key.code);
          return next;
        });
      }, 110);
    },
    [hit],
  );

  // 物理キーボードの押下/離上を監視。
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      // OS のキーリピートでは鳴らさない（押しっぱなしの連打音を防ぐ）。
      if (e.repeat) return;
      hit();
      setPressed((prev) => {
        if (prev.has(e.code)) return prev;
        const next = new Set(prev);
        next.add(e.code);
        return next;
      });
    };
    const onUp = (e: KeyboardEvent) => {
      setPressed((prev) => {
        if (!prev.has(e.code)) return prev;
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [hit]);

  // ---- 自動打鍵モード ----
  // ON の間、ランダムなサンプル文を 1 文字ずつ打って音を鳴らし続ける。
  useEffect(() => {
    if (!autoTyping) return;

    let cancelled = false;
    let phrase = randomSample();
    let idx = 0;

    const step = () => {
      if (cancelled) return;
      const speed = autoSpeedRef.current;
      if (idx >= phrase.length) {
        // 1 文を打ち切ったら少し間を置いて次の文へ（間も速度に追従）。
        phrase = randomSample();
        idx = 0;
        setText("");
        autoTimerRef.current = window.setTimeout(step, 700 / speed);
        return;
      }
      const ch = phrase[idx++];
      hit();
      // 該当キーをハイライト。
      const code = codeForChar(ch);
      if (code) {
        setPressed((prev) => {
          const next = new Set(prev);
          next.add(code);
          return next;
        });
        window.setTimeout(() => {
          setPressed((prev) => {
            const next = new Set(prev);
            next.delete(code);
            return next;
          });
        }, 90);
      }
      setText((t) => t + ch);
      // 人間らしいゆらぎ。スペースの後はやや長めの間を取る。間隔は速度倍率で割る。
      const jitter = 0.6 + Math.random() * 0.9;
      const extra = ch === " " ? 120 : 0;
      autoTimerRef.current = window.setTimeout(step, (AUTO_TYPE_BASE_MS * jitter + extra) / speed);
    };

    autoTimerRef.current = window.setTimeout(step, AUTO_TYPE_BASE_MS / autoSpeedRef.current);

    return () => {
      cancelled = true;
      if (autoTimerRef.current != null) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [autoTyping, hit]);

  const selected = KEY_SWITCHES.find((s) => s.id === switchId);

  return (
    <div className="typing">
      {/* スイッチ選択・音量・モード切替パネル */}
      <div className="typing__panel">
        <div className="typing__switches">
          {KEY_SWITCHES.map((sw) => (
            <button
              type="button"
              key={sw.id}
              className={"typing__switch" + (sw.id === switchId ? " typing__switch--active" : "")}
              onClick={() => setSwitchId(sw.id)}
            >
              {sw.japanese}
            </button>
          ))}
        </div>
        <div className="typing__controls">
          <label className="typing__volume">
            音量
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className={"typing__auto" + (autoTyping ? " typing__auto--on" : "")}
            onClick={() => setAutoTyping((v) => !v)}
          >
            {autoTyping ? "■ 自動打鍵を停止" : "▶ 自動打鍵モード"}
          </button>
          <label className="typing__speed">
            速度
            <input
              type="range"
              min={AUTO_SPEED_MIN}
              max={AUTO_SPEED_MAX}
              step={0.1}
              value={autoSpeed}
              onChange={(e) => setAutoSpeed(Number(e.target.value))}
            />
            <span className="typing__speed-value">{autoSpeed.toFixed(1)}×</span>
          </label>
        </div>
      </div>

      {/* 中央の大きなキーボード */}
      <div className="typing__keyboard-wrap">
        <Keyboard pressed={pressed} onKeyTap={handleKeyTap} />
      </div>

      {/* キーボードの下のサンプルテキスト/入力欄 */}
      <div className="typing__text-wrap">
        <textarea
          ref={textareaRef}
          className="typing__textarea"
          value={text}
          placeholder={
            autoTyping
              ? "自動打鍵モード実行中…"
              : "ここに自由にタイプして打鍵音を楽しもう（物理キーボード・画面クリックどちらもOK）"
          }
          readOnly={autoTyping}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoFocus
        />
        <div className="typing__hint">
          {selected ? `${selected.japanese}（${selected.english}）` : ""}
        </div>
      </div>
    </div>
  );
}
