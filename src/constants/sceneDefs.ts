// シーン定義。enabled:false は「これから作る」プレースホルダ。
// name はルーティング用（/marbles など）。component は ScenePage が描画する R3F シーン。
import type { ComponentType } from "react";
import MarblesScene from "../features/marbles/MarblesScene";

export interface SceneDef {
  name: string;
  emoji: string;
  label: string;
  enabled: boolean;
  component?: ComponentType;
}

export const sceneDefs: SceneDef[] = [
  { name: "marbles", emoji: "🔮", label: "ビー玉の箱", enabled: true, component: MarblesScene },
  { name: "nature", emoji: "🌿", label: "森と海", enabled: false },
  { name: "typing", emoji: "⌨️", label: "タイピング", enabled: false },
  { name: "squeeze", emoji: "🫧", label: "スクイーズ", enabled: false },
];

export function findScene(name: string | undefined): SceneDef | undefined {
  return sceneDefs.find((d) => d.name === name);
}
