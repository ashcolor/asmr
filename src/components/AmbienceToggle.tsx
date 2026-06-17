// 環境音のオンオフを切り替える小さなボタン。
// シーンの隅に置いて、ループ再生中の環境音をワンタップで止め/再開できる。

interface AmbienceToggleProps {
  enabled: boolean;
  onToggle: () => void;
  /** ボタンに添えるラベル（例: "波の音"）。 */
  label?: string;
  className?: string;
}

export default function AmbienceToggle({
  enabled,
  onToggle,
  label = "環境音",
  className = "",
}: AmbienceToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={`${label}を${enabled ? "オフ" : "オン"}にする`}
      className={
        "btn btn-sm gap-2 rounded-full" +
        (enabled ? " btn-primary" : " btn-neutral") +
        (className ? " " + className : "")
      }
    >
      {/* オン: スピーカー＋音波 / オフ: ミュート */}
      {enabled ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"
          />
        </svg>
      )}
      <span className="text-sm">{label}</span>
    </button>
  );
}
