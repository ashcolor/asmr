// ビー玉の箱シーンの R3F ホスト。
// レンダラー/カメラ/リサイズは <Canvas> に委譲し、旧 marbles.js の renderer 設定値を
// props と onCreated で明示して見た目を一致させる。中身（物理・メッシュ）は <Marbles/>。
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Marbles from "./Marbles";

export default function MarblesScene() {
  return (
    <Canvas
      id="scene"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: 45, near: 0.1, far: 100, position: [0, 18, 0] }}
      // 右クリックのブラウザメニューを抑制（右ドラッグで視点移動するため）。
      onContextMenu={(e) => e.preventDefault()}
      onCreated={({ gl, camera }) => {
        // 旧コードと同じトーンマッピングで白飛びを抑え、上品な明るさにする。
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.62;
        // 真上カメラでは既定の up=(0,1,0) が視線方向と平行になり、レイキャストが不安定になる。
        camera.up.set(0, 0, -1);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
      }}
    >
      {/* 白基調・海辺の空気感。フォグで遠くが霞む。 */}
      <color attach="background" args={[0xeaf2f5]} />
      <fog attach="fog" args={[0xeaf2f5, 22, 42]} />
      <Marbles />
      {/* 視点移動は右ドラッグのみ。左ドラッグは玉を混ぜる操作に残す。 */}
      <OrbitControls
        target={[0, 0, 0]}
        enablePan={false}
        minDistance={8}
        maxDistance={45}
        maxPolarAngle={Math.PI / 1.8}
        mouseButtons={{
          LEFT: undefined as unknown as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        touches={{ ONE: undefined as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_PAN }}
      />
    </Canvas>
  );
}
