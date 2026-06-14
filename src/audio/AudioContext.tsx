// 音声有効化フローを React の Context で配る。
// audioReady: ブラウザの自動再生制限が解除済みか。
// unlock(): ユーザージェスチャ内で呼ぶ。AudioContext を resume し、サンプルをプリロードする。
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { initAudio, resumeAudio } from "./audio";

interface AudioState {
  audioReady: boolean;
  unlock: () => Promise<void>;
}

const Ctx = createContext<AudioState>({ audioReady: false, unlock: async () => {} });

export function AudioProvider({ children }: { children: ReactNode }) {
  const [audioReady, setAudioReady] = useState(false);

  // AudioContext 自体はアプリ起動時に1度だけ用意しておく（resume はまだしない）。
  // initAudio は ctx 既存ならガードされるので StrictMode の二重呼び出しでも安全。
  useEffect(() => {
    initAudio();
  }, []);

  const unlock = useCallback(async () => {
    await resumeAudio();
    setAudioReady(true);
  }, []);

  return <Ctx.Provider value={{ audioReady, unlock }}>{children}</Ctx.Provider>;
}

export function useAudio(): AudioState {
  return useContext(Ctx);
}
