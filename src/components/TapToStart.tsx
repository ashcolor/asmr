// 最初のタップを促すオーバーレイ（音声有効化のため）。
// onTap はユーザージェスチャ内で AudioContext を resume する（AudioProvider.unlock）。
import { Icon } from "@iconify/react";

export default function TapToStart({ onTap }: { onTap: () => void }) {
  return (
    <div id="tap-to-start" onClick={onTap}>
      <p>
        <Icon icon="mdi:gesture-tap" />
        画面をタップして はじめる
        <span className="tap-hint">
          <Icon icon="mdi:volume-high" />
          クリックすると音がでます
        </span>
      </p>
    </div>
  );
}
