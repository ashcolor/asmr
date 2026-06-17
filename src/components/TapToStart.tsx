// 最初のタップを促すオーバーレイ（音声有効化のため）。
// onTap はユーザージェスチャ内で AudioContext を resume する（AudioProvider.unlock）。
import { Icon } from "@iconify/react";

export default function TapToStart({ onTap }: { onTap: () => void }) {
  return (
    <div
      id="tap-to-start"
      className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-base-300/60"
      onClick={onTap}
    >
      <p className="alert alert-info flex w-auto max-w-[90vw] flex-col items-center gap-2 px-8 py-5 text-center text-lg tracking-[0.1em] shadow-xl">
        <Icon icon="mdi:gesture-tap" className="text-2xl" />
        画面をタップして はじめる
        <span className="flex items-center gap-1 text-sm">
          <Icon icon="mdi:volume-high" />
          クリックすると音がでます
        </span>
      </p>
    </div>
  );
}
