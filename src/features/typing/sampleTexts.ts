// 自動打鍵モードで流すサンプル文。打鍵 ASMR 用に、英字キーが心地よく連続する文を選ぶ。
// 日本語キーボード音源だが音はローマ字打鍵を想定しないので、表示は英文にする。
// 内容は読んでいて心地よい、名言・文学からの有名な一節を中心にしている。
export const SAMPLE_TEXTS: string[] = [
  // ジェーン・オースティン『高慢と偏見』冒頭の一文。
  "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
  // チャールズ・ディケンズ『二都物語』の有名な対句。
  "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.",
  // ヘミングウェイ的な静けさ。実際はメルヴィル『白鯨』の書き出し。
  "Call me Ishmael. Some years ago, having little money in my purse, I thought I would sail about and see the world.",
  // ニール・アームストロングの月面での言葉。
  "That's one small step for man, one giant leap for mankind.",
  // セオドア・ルーズベルトの演説より、行動する者を讃える一節。
  "It is not the critic who counts; the credit belongs to the one who is actually in the arena.",
  // ラオツ（老子）に帰される箴言。長い道のりも一歩から。
  "The journey of a thousand miles begins with a single step, taken quietly beneath your tired feet.",
  // ロバート・フロスト『選ばれざる道』の結び。
  "Two roads diverged in a wood, and I took the one less traveled by, and that has made all the difference.",
  // シェイクスピア『ハムレット』の独白の冒頭。
  "To be, or not to be, that is the question, whether 'tis nobler in the mind to suffer the slings of fortune.",
  // マルクス・アウレリウス『自省録』の精神。
  "You have power over your mind, not outside events. Realize this, and you will find your quiet strength.",
  // カール・セーガンの宇宙への憧れ。
  "We are made of star stuff, and somewhere, something incredible is waiting to be known by patient minds.",
  // マーティン・ルーサー・キング Jr.『I Have a Dream』より。
  "I have a dream that one day my children will be judged not by the color of their skin but by their character.",
  // ガンジーに帰される言葉。世界を変えたいなら、まず自分から。
  "Be the change that you wish to see in the world, and let your quiet actions speak louder than your words.",
  // ジョン・F・ケネディの就任演説より。
  "Ask not what your country can do for you; ask what you can do for your country in the days ahead.",
  // ネルソン・マンデラの不屈の精神。
  "The greatest glory in living lies not in never falling, but in rising every time we fall down again.",
  // ヘレン・ケラーの言葉。冒険か、無か。
  "Life is either a daring adventure or nothing at all, so face each new day with an open and willing heart.",
  // アインシュタインに帰される名言。
  "Imagination is more important than knowledge, for knowledge is limited while imagination embraces the world.",
  // オスカー・ワイルドの軽妙な一言。
  "We are all in the gutter, but some of us are looking up at the stars on a clear and silent winter night.",
  // ヘンリー・デイヴィッド・ソロー『ウォールデン』より。
  "I went to the woods because I wished to live deliberately and learn what the quiet forest had to teach.",
  // マヤ・アンジェロウの言葉。人は感情を記憶する。
  "People will forget what you said, but they will never forget how you made them feel in that moment.",
  // マーク・トウェインのユーモラスな処世訓。
  "Twenty years from now you will be more disappointed by the things you did not do than by the ones you did.",
  // アリストテレスに帰される言葉。習慣が人をつくる。
  "We are what we repeatedly do; excellence, then, is not an act but a quiet and patient habit of the heart.",
  // ヴィクトル・ユゴーの言葉。時を得た思想は強い。
  "Nothing is more powerful than an idea whose time has finally come to be heard by the waiting world.",
  // 孔子の言葉。歩みを止めなければよい。
  "It does not matter how slowly you go, as long as you do not stop walking toward the things you love.",
  // スティーヴ・ジョブズのスタンフォード卒業式講演より。
  "Your time is limited, so do not waste it living someone else's life or letting their noise drown your own.",
  // F・スコット・フィッツジェラルド『グレート・ギャツビー』結び。
  "So we beat on, boats against the current, borne back ceaselessly into the bright past we cannot leave.",
  // ルイス・キャロル『不思議の国のアリス』より。
  "If you do not know where you are going, any road will take you there, said the cat with a knowing smile.",
  // ラルフ・ワルド・エマソンの言葉。自分の道を行け。
  "Do not go where the path may lead; go instead where there is no path and leave a gentle trail behind you.",
  // ソクラテスに帰される言葉。吟味された人生を。
  "The unexamined life is not worth living, so question gently, listen closely, and never stop learning.",
  // J・R・R・トールキン『指輪物語』より、放浪者の詩。
  "Not all those who wander are lost; the old that is strong does not wither, deep roots are not reached by frost.",
  // セネカ『生の短さについて』の精神。
  "It is not that we have a short time to live, but that we waste a great deal of it on trivial worries.",
];

// ランダムにサンプル文を1つ返す。
export function randomSample(): string {
  return SAMPLE_TEXTS[(Math.random() * SAMPLE_TEXTS.length) | 0];
}
