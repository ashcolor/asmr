// シーンの環境音（ambience）をオンオフ・音量管理する共通フック。
// 指定したトラック群をループ再生し、ON/OFF を toggle で、音量を setVolume で切り替える。
// 音声がアンロックされる前に enabled=true でも、アンロック後に自動で鳴り出す。
import { useCallback, useEffect, useState } from "react";
import { playAmbience, setAmbienceVolume, stopAmbience } from "./audio";
import { useAudio } from "./AudioContext";

interface UseAmbienceResult {
  /** 現在オンかどうか。 */
  enabled: boolean;
  /** オン/オフを切り替える。 */
  toggle: () => void;
  /** 現在の音量(0..1)。 */
  volume: number;
  /** 音量を変える(0..1)。鳴っていればリアルタイムに反映される。 */
  setVolume: (v: number) => void;
}

// localStorage の保存キー接頭辞（シーンごとに storageKey で分ける）。
const STORAGE_PREFIX = "ambience-volume:";

/**
 * @param tracks       重ねて流すトラックの url 配列（複数可）。
 * @param initialVolume 初期音量(0..1)。localStorage に保存値があればそちらを優先。
 * @param initialOn    初期状態でオンにするか。
 * @param storageKey   音量を localStorage に保存するためのキー（省略時は保存しない）。
 */
export function useAmbience(
  tracks: string[],
  initialVolume = 0.6,
  initialOn = true,
  storageKey?: string,
): UseAmbienceResult {
  const { audioReady } = useAudio();
  const [enabled, setEnabled] = useState(initialOn);
  const [volume, setVolumeState] = useState(() => {
    if (!storageKey) return initialVolume;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
      const v = raw != null ? Number(raw) : NaN;
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : initialVolume;
    } catch {
      return initialVolume;
    }
  });

  // tracks が毎回新しい配列でも依存が安定するよう key にまとめる。
  const tracksKey = tracks.join("|");

  // enabled / audioReady / 構成 が変わるたびに再生状態を合わせる。
  // 音量は別 effect でリアルタイムに反映するので、ここの依存には入れない。
  useEffect(() => {
    if (audioReady && enabled) {
      void playAmbience(tracksKey ? tracksKey.split("|") : [], volume);
    } else {
      stopAmbience();
    }
    // volume は意図的に依存から外す（鳴らし直しを避けるため）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioReady, enabled, tracksKey]);

  // 音量が変わったら、鳴っている音にリアルタイムで反映する。
  useEffect(() => {
    setAmbienceVolume(volume);
  }, [volume]);

  // シーンを離れる（アンマウント）ときは必ず止める。
  useEffect(() => {
    return () => stopAmbience();
  }, []);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  const setVolume = useCallback(
    (v: number) => {
      const next = Math.min(1, Math.max(0, v));
      setVolumeState(next);
      if (storageKey) {
        try {
          localStorage.setItem(STORAGE_PREFIX + storageKey, String(next));
        } catch {
          // 保存失敗は致命的ではないので無視。
        }
      }
    },
    [storageKey],
  );

  return { enabled, toggle, volume, setVolume };
}
