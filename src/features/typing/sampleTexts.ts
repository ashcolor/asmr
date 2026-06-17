// 自動打鍵モードで流すサンプル文。打鍵 ASMR 用に、英字キーが心地よく連続する文を選ぶ。
// 日本語キーボード音源だが音はローマ字打鍵を想定しないので、表示は英文にする。
export const SAMPLE_TEXTS: string[] = [
  "The quick brown fox jumps over the lazy dog while the gentle rain taps softly on the window.",
  "She sells seashells by the seashore, and the sound of each keystroke melts into the quiet evening.",
  "Coding late at night, the only sound is the steady rhythm of keys clicking under tired fingers.",
  "A calm cup of tea, a warm blanket, and the soft clatter of a mechanical keyboard in the dark.",
  "Pack my box with five dozen liquor jugs, then settle in and let the typing rhythm carry you away.",
];

// ランダムにサンプル文を1つ返す。
export function randomSample(): string {
  return SAMPLE_TEXTS[(Math.random() * SAMPLE_TEXTS.length) | 0];
}
