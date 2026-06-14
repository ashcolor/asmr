// 最初のタップを促すオーバーレイ（音声有効化のため）。
// onTap はユーザージェスチャ内で AudioContext を resume する（AudioProvider.unlock）。
export default function TapToStart({ onTap }: { onTap: () => void }) {
  return (
    <div id="tap-to-start" onClick={onTap}>
      <p>画面をタップして はじめる</p>
    </div>
  );
}
