// ビー玉の箱シーンの R3F ホスト。
// レンダラー/カメラ/リサイズは <Canvas> に委譲し、旧 marbles.js の renderer 設定値を
// props と onCreated で明示して見た目を一致させる。中身（物理・メッシュ）は <Marbles/>。
import { useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Marbles from "./Marbles";
import AmbienceToggle from "../../components/AmbienceToggle";
import { useAmbience } from "../../audio/useAmbience";
import { MARBLES_AMBIENCE } from "../../constants/ambienceDefs";

export default function MarblesScene() {
  // 砂浜の明るさ。1=テクスチャそのまま。スライダーで下げると砂が暗くなる。
  const [sandBrightness, setSandBrightness] = useState(0.7);
  // 波の環境音（ループ）。音声アンロック後に自動で鳴り始める。音量は保存・復元する。
  const ambience = useAmbience(MARBLES_AMBIENCE.tracks, MARBLES_AMBIENCE.volume, true, "marbles");

  return (
    <>
      <Canvas
        id="scene"
        className="absolute inset-0 h-full w-full touch-none"
        // ソフトシャドウ(PCFSoft)で影の縁を柔らかくし、リアルな陰影にする。
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        // far を広げ、ズームアウトしても遠景が切れて消えないようにする。
        camera={{ fov: 45, near: 0.1, far: 300, position: [0, 18, 0] }}
        // 右クリックのブラウザメニューを抑制（右ドラッグで視点移動するため）。
        onContextMenu={(e) => e.preventDefault()}
        onCreated={({ gl, camera }) => {
          // ACESFilmic で白飛びを抑えつつ、露出を上げてガラスの透明感と明るさを出す。
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.85;
          // 真上カメラでは既定の up=(0,1,0) が視線方向と平行になり、レイキャストが不安定になる。
          camera.up.set(0, 0, -1);
          camera.lookAt(0, 0, 0);
          camera.updateMatrixWorld();
        }}
      >
        {/* 白基調・海辺の空気感。フォグは遠くで薄く霞ませる程度にして、少し離れても消えないようにする。 */}
        <color attach="background" args={[0xeaf2f5]} />
        <fog attach="fog" args={[0xeaf2f5, 60, 180]} />
        <Marbles sandBrightness={sandBrightness} />
        {/* 視点移動は右ドラッグのみ。左ドラッグは玉を混ぜる操作に残す。 */}
        <OrbitControls
          target={[0, 0, 0]}
          enablePan={false}
          mouseButtons={{
            LEFT: undefined as unknown as THREE.MOUSE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
          touches={{ ONE: undefined as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_PAN }}
        />
      </Canvas>

      {/* 砂浜の明るさ調整パネル（画面左下）。 */}
      <div className="absolute bottom-5 left-5 z-10 flex w-52 flex-col gap-3 rounded-box border border-base-300 bg-base-200 p-4 text-base-content shadow-xl">
        {/* 環境音（波の音）のオンオフ。 */}
        <AmbienceToggle
          enabled={ambience.enabled}
          onToggle={ambience.toggle}
          label={MARBLES_AMBIENCE.label}
          className="w-full"
        />
        {/* 環境音の音量。オフのときはスライダーを無効化する。 */}
        <label
          className="flex items-center justify-between text-sm tracking-[0.05em]"
          htmlFor="ambience-volume"
        >
          BGM の音量
          <span className="font-mono tabular-nums text-base-content/70">
            {ambience.volume.toFixed(2)}
          </span>
        </label>
        <input
          id="ambience-volume"
          className="range range-primary range-xs w-full"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={ambience.volume}
          disabled={!ambience.enabled}
          onChange={(e) => ambience.setVolume(Number(e.target.value))}
        />
        <label
          className="flex items-center justify-between text-sm tracking-[0.05em]"
          htmlFor="sand-brightness"
        >
          砂浜の明るさ
          <span className="font-mono tabular-nums text-base-content/70">
            {sandBrightness.toFixed(2)}
          </span>
        </label>
        <input
          id="sand-brightness"
          className="range range-primary range-xs w-full"
          type="range"
          min={0.1}
          max={1.5}
          step={0.01}
          value={sandBrightness}
          onChange={(e) => setSandBrightness(Number(e.target.value))}
        />
      </div>
    </>
  );
}
