// シーンごとの環境音（ambience）定義。
// tracks は重ねて同時にループ再生するトラックの url 配列。
// label はオンオフボタンに表示する短い名前。

export interface AmbienceDef {
  label: string;
  tracks: string[];
  volume: number;
}

// ビー玉の箱: 砂浜の世界観に合わせた波の音。
export const MARBLES_AMBIENCE: AmbienceDef = {
  label: "波の音",
  tracks: ["/sounds/ambience/seaside_ambience_60s.mp3"],
  volume: 0.7,
};

// タイピング: 会話のざわめき + 物音 を重ねたオフィス／カフェ風の環境音。
export const TYPING_AMBIENCE: AmbienceDef = {
  label: "ざわめき",
  tracks: [
    "/sounds/ambience/workplace_conversation_murmur_60s.mp3",
    "/sounds/ambience/workplace_nonverbal_sounds_60s.mp3",
  ],
  volume: 0.6,
};
