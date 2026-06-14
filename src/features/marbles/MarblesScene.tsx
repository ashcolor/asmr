// ビー玉の箱シーンの R3F ホスト。
// レンダラー/カメラ/リサイズは <Canvas> に委譲し、旧 marbles.js の renderer 設定値を
// props と onCreated で明示して見た目を一致させる。中身（物理・メッシュ）は <Marbles/>。
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import Marbles from "./Marbles";

export default function MarblesScene() {
  return (
    <Canvas
      id="scene"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: 45, near: 0.1, far: 100, position: [0, 18, 0.001] }}
      onCreated={({ gl, camera }) => {
        // 旧コードと同じトーンマッピングで白飛びを抑え、上品な明るさにする。
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.62;
        camera.lookAt(0, 0, 0);
      }}
    >
      {/* 白基調・海辺の空気感。フォグで遠くが霞む。 */}
      <color attach="background" args={[0xeaf2f5]} />
      <fog attach="fog" args={[0xeaf2f5, 22, 42]} />
      <Marbles />
    </Canvas>
  );
}
