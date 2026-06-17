// Web Audio API のラッパー。
// ビー玉の衝突音は録音サンプル(public/sounds/marble/marble_1〜5.wav)を再生する。
// 衝突のたびに5種類からランダムに1つ選び、音量(intensity)を衝突の強さに反映する。
// サンプルが読み込めなかった場合は合成音にフォールバックする。

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

// サンプルのデコード済みバッファ。複数登録できるようにしておく。
const buffers = new Map<string, AudioBuffer>();

// ビー玉の衝突音バリエーション（80ms 前後の短いワンショット）。
const MARBLE_SAMPLES = ["marble_1", "marble_2", "marble_3", "marble_4", "marble_5"];

const SAMPLE_DEFS: Record<string, { url: string }> = Object.fromEntries(
  MARBLE_SAMPLES.map((name) => [name, { url: `/sounds/marble/${name}.wav` }]),
);

export function initAudio(): AudioContext {
  if (ctx) return ctx;
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  return ctx;
}

// ブラウザの自動再生制限を解除するため、最初のユーザー操作で呼ぶ。
// ついでにサンプルのプリロードもここで走らせる。
export async function resumeAudio(): Promise<void> {
  if (!ctx) initAudio();
  if (ctx!.state === "suspended") {
    await ctx!.resume();
  }
  await preloadSamples();
}

export function getContext(): AudioContext | null {
  return ctx;
}

let preloadPromise: Promise<unknown> | null = null;
function preloadSamples(): Promise<unknown> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = Promise.all(
    Object.entries(SAMPLE_DEFS).map(async ([name, def]) => {
      try {
        const res = await fetch(def.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        const buf = await ctx!.decodeAudioData(arr);
        buffers.set(name, buf);
      } catch (e) {
        // 読み込めなくても合成音で動くので、警告だけ出して続行
        console.warn(`[audio] sample "${name}" load failed, will synthesize:`, e);
      }
    }),
  );
  return preloadPromise;
}

// ---- 同時再生の抑制 ----
// サンプルが 80ms 前後と短いので、衝突のたびに鳴らしても詰まりにくい。
// クールダウンは設けず、同時発音数の上限だけ緩く残してクリッピングを防ぐ。
const MAX_VOICES = 16; // 同時に鳴らせる音の数（上限のみ）
let activeVoices = 0;

/**
 * ビー玉同士・壁との衝突音。
 * 5種類の録音サンプルからランダムに1つ選んで鳴らす。
 * @param intensity 0..1 衝突の強さ（音量に反映）
 */
export function playMarble(intensity = 0.5): void {
  if (!ctx) return;
  const i = Math.min(1, Math.max(0.05, intensity));

  // 同時発音数が上限なら、よほど強い衝突以外は捨てる
  if (activeVoices >= MAX_VOICES && i < 0.85) return;

  const name = MARBLE_SAMPLES[(Math.random() * MARBLE_SAMPLES.length) | 0];
  const buf = buffers.get(name);
  if (buf) {
    playSample(buf, i);
  } else {
    synthMarble(i);
  }
}

// ---- サンプル再生 ----
function playSample(buf: AudioBuffer, intensity: number): void {
  const c = ctx!;
  const now = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = buf;

  // 微小なランダムを足して「全く同じ音」を避ける（音程は変えない）
  src.playbackRate.value = 0.98 + Math.random() * 0.04;

  const gain = c.createGain();
  // 衝突の強さで音量を決める。弱い衝突は控えめに。
  gain.gain.value = 0.15 + intensity * 0.65;

  src.connect(gain).connect(master!);

  // 発音数カウント。再生し終わったら減らす。
  activeVoices++;
  src.onended = () => {
    activeVoices--;
  };
  src.start(now);
}

// ============================================================
// キーボードタイピング ASMR 用のキースイッチ音
// ============================================================
// 音源は key-switch-tester (https://github.com/ashcolor/key-switch-tester) と
// 同じ GCS 上の mp3 を使う。スイッチ種類ごとに 3 サンプルあり、打鍵のたびに
// ランダムで 1 つ選んで鳴らす。CORS は許可済み(*)なので fetch→decode で乗せられる。

const SWITCH_SOUND_BASE = "https://storage.googleapis.com/key-switch-tester/sound/v2";

export interface KeySwitchDef {
  id: string; // 内部識別子 / URL のファイル名プレフィックス
  japanese: string;
  english: string;
  samples: number; // サンプル数（{id}{0..samples-1}.mp3）
}

// 選択肢として出すキースイッチ一覧。key-switch-tester の constants.ts に準拠。
export const KEY_SWITCHES: KeySwitchDef[] = [
  { id: "red", japanese: "赤軸", english: "Red (Linear)", samples: 3 },
  { id: "brown", japanese: "茶軸", english: "Brown (Tactile)", samples: 3 },
  { id: "blue", japanese: "青軸", english: "Blue (Clicky)", samples: 3 },
  { id: "topre", japanese: "東プレ", english: "Topre", samples: 3 },
  { id: "mac", japanese: "MacBook", english: "MacBook", samples: 3 },
];

// スイッチごとのデコード済みバッファ。id -> AudioBuffer[]。
const switchBuffers = new Map<string, AudioBuffer[]>();
// スイッチごとのロード Promise。同じスイッチを二重に取りにいかないためのキャッシュ。
const switchLoadPromises = new Map<string, Promise<AudioBuffer[]>>();

/**
 * 指定スイッチのサンプル群を読み込む（キャッシュ付き）。
 * 失敗したサンプルは黙ってスキップし、読めたものだけ返す。
 */
export function loadKeySwitch(id: string): Promise<AudioBuffer[]> {
  const cached = switchLoadPromises.get(id);
  if (cached) return cached;

  const def = KEY_SWITCHES.find((s) => s.id === id);
  if (!def) {
    return Promise.resolve([]);
  }
  if (!ctx) initAudio();

  const promise = Promise.all(
    Array.from({ length: def.samples }, async (_, i) => {
      const url = `${SWITCH_SOUND_BASE}/${id}${i}.mp3`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        return await ctx!.decodeAudioData(arr);
      } catch (e) {
        console.warn(`[audio] key switch sample "${id}${i}" load failed:`, e);
        return null;
      }
    }),
  ).then((bufs) => {
    const ok = bufs.filter((b): b is AudioBuffer => b != null);
    switchBuffers.set(id, ok);
    return ok;
  });

  switchLoadPromises.set(id, promise);
  return promise;
}

/**
 * キースイッチの打鍵音を 1 回鳴らす。
 * 指定スイッチのサンプルからランダムに 1 つ選ぶ。未ロードなら何も鳴らない（無音）。
 * @param id      スイッチ識別子（red / brown / ...）
 * @param volume  0..1 音量
 */
export function playKeySwitch(id: string, volume = 0.9): void {
  if (!ctx) return;
  const bufs = switchBuffers.get(id);
  if (!bufs || bufs.length === 0) return;

  // 同時発音数の上限はビー玉と共有。連打でも詰まりにくいよう緩めに。
  if (activeVoices >= MAX_VOICES) return;

  const buf = bufs[(Math.random() * bufs.length) | 0];
  const c = ctx;
  const now = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = buf;
  // ごく僅かなランダムで「全く同じ音」の連打を避ける（音程はほぼ変えない）。
  src.playbackRate.value = 0.99 + Math.random() * 0.02;

  const gain = c.createGain();
  gain.gain.value = Math.min(1, Math.max(0, volume));
  src.connect(gain).connect(master!);

  activeVoices++;
  src.onended = () => {
    activeVoices--;
  };
  src.start(now);
}

// ---- フォールバック: 合成音（サンプルが無いとき）----
function synthMarble(intensity: number): void {
  const c = ctx!;
  const now = c.currentTime;
  const i = intensity;

  // 玉ごとの微小なゆらぎだけ残す（音程の意図的な変更はしない）
  const pitch = 0.97 + Math.random() * 0.06;

  const osc = c.createOscillator();
  const gain = c.createGain();
  const baseFreq = 1600 * pitch;

  osc.type = "sine";
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + 0.04);

  const vol = 0.25 * i;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(vol, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12 + i * 0.1);

  const osc2 = c.createOscillator();
  const gain2 = c.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(baseFreq * 2.7, now);
  gain2.gain.setValueAtTime(0.0001, now);
  gain2.gain.exponentialRampToValueAtTime(vol * 0.4, now + 0.002);
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  osc.connect(gain).connect(master!);
  osc2.connect(gain2).connect(master!);

  osc.start(now);
  osc2.start(now);
  osc.stop(now + 0.3);
  osc2.stop(now + 0.2);
}
