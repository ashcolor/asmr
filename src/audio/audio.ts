// Web Audio API のラッパー。
// ビー玉の衝突音は録音サンプル(public/sounds/glass-clink.mp3)を再生する。
// 1ファイルから、音量(intensity)と再生速度(pitch)を動的に変えて多彩な衝突音を作る。
// サンプルが読み込めなかった場合は合成音にフォールバックする。

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

// サンプルのデコード済みバッファ。複数登録できるようにしておく。
const buffers = new Map<string, AudioBuffer>();

const SAMPLE_DEFS: Record<string, { url: string }> = {
  marble: { url: "/sounds/glass-clink.mp3" },
};

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
// 鳴りすぎを防ぐため、3つの制御を入れている:
//  1) クールダウン: 直前の発音から MIN_GAP 秒経たないと鳴らさない
//  2) 同時発音数の上限: 今鳴っている音が MAX_VOICES を超えたら鳴らさない
//  3) 強い衝突を優先: クールダウン中でも、直前より明らかに強い衝突は割り込んで鳴らす
const MIN_GAP = 0.025; // 秒。連続発音の最短間隔
const MAX_VOICES = 6; // 同時に鳴らせる音の数
let lastPlayTime = -1;
let lastIntensity = 0;
let activeVoices = 0;

/**
 * ビー玉同士・壁との衝突音。
 * @param intensity 0..1 衝突の強さ（音量に反映）
 * @param pitch     0.7..1.4 くらい。玉ごとに少し変えると自然（再生速度に反映）
 */
export function playMarble(intensity = 0.5, pitch = 1.0): void {
  if (!ctx) return;
  const i = Math.min(1, Math.max(0.05, intensity));
  const now = ctx.currentTime;

  // 同時発音数が上限なら、よほど強い衝突以外は捨てる
  if (activeVoices >= MAX_VOICES && i < 0.85) return;

  // クールダウン中は、直前より明確に強い衝突だけ通す（アクセントを残す）
  if (now - lastPlayTime < MIN_GAP && i < lastIntensity + 0.25) return;

  lastPlayTime = now;
  lastIntensity = i;

  const buf = buffers.get("marble");
  if (buf) {
    playSample(buf, i, pitch);
  } else {
    synthMarble(i, pitch);
  }
}

// ---- サンプル再生 ----
function playSample(buf: AudioBuffer, intensity: number, pitch: number): void {
  const c = ctx!;
  const now = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = buf;

  // ピッチ違い + 微小なランダムを足して「全く同じ音」を避ける
  src.playbackRate.value = pitch * (0.97 + Math.random() * 0.06);

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

// ---- フォールバック: 合成音（サンプルが無いとき）----
function synthMarble(intensity: number, pitch: number): void {
  const c = ctx!;
  const now = c.currentTime;
  const i = intensity;

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
