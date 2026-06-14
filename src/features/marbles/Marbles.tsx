// ビー玉の箱: Three.js (描画) + Rapier3D (物理)。旧 src/scenes/marbles.js の R3F 移植版。
// レンダラー/カメラ/リサイズは <Canvas> が持つので、ここでは物理・メッシュ・手・傾き・音だけを扱う。
//
// 設計: 物理状態（world / 玉 / 箱 / 手 / 逆引き Map）は React の state ではなく ref に閉じ込め、
//   60fps の再レンダリングを避ける。初期化は useEffect（マウント時1回）で命令的に行い、
//   毎フレームの step + 衝突 drain + メッシュ同期は useFrame で回す。dispose は cleanup へ。
import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import RAPIER from "@dimforge/rapier3d-compat";
import { playMarble } from "../../audio/audio";

interface Marble {
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  pitch: number;
}

interface Sim {
  world: RAPIER.World;
  eventQueue: RAPIER.EventQueue;
  marbles: Marble[];
  handleToMarble: Map<number, Marble>;
  boxBody: RAPIER.RigidBody;
  handBody: RAPIER.RigidBody;
  glassGroup: THREE.Group;
  HALF_W: number;
  HALF_D: number;
  handActive: boolean;
  handTarget: THREE.Vector3;
  tiltPhase: number;
  soundsThisFrame: number;
}

export default function Marbles() {
  const { scene, camera, gl, size } = useThree();
  const sim = useRef<Sim | null>(null); // 物理・メッシュ一式（初期化後にセット）
  const ready = useRef(false);
  // useFrame から最新の canvas サイズを参照するための ref（リサイズに追従）。
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    let disposed = false;

    // 後で cleanup から参照するハンドラ・リソースを溜めておく。
    const cleanups: (() => void)[] = [];

    (async () => {
      await RAPIER.init();
      // StrictMode の二重マウント等で、init 完了前にアンマウントされていたら中断。
      if (disposed) return;

      // ---- 環境マップ（ガラスの映り込み）----
      // 透明マテリアルは映り込む環境が無いと真っ黒に透けるので、RoomEnvironment で簡易的な
      // 室内の映り込みを作る。これがガラス感の決め手。
      const pmrem = new THREE.PMREMGenerator(gl);
      const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTexture;

      // ---- ライティング ----
      // 海辺の明るい昼下がり。空(水色)と砂浜(暖色)からの光で柔らかく照らす。
      const lights = new THREE.Group();
      const hemi = new THREE.HemisphereLight(0xdff0ff, 0xfff0d8, 0.7);
      lights.add(hemi);
      lights.add(new THREE.AmbientLight(0xffffff, 0.2));
      const key = new THREE.DirectionalLight(0xfff6ea, 1.2); // 陽射し
      key.position.set(6, 14, 6);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -10;
      key.shadow.camera.right = 10;
      key.shadow.camera.top = 10;
      key.shadow.camera.bottom = -10;
      key.shadow.bias = -0.0005;
      lights.add(key);
      const fill = new THREE.DirectionalLight(0xbfe0ff, 0.35); // 空の照り返し
      fill.position.set(-6, 8, -4);
      lights.add(fill);
      scene.add(lights);

      // ---- 物理ワールド ----
      const gravity = { x: 0, y: -9.81 * 2.2, z: 0 };
      const world = new RAPIER.World(gravity);
      const eventQueue = new RAPIER.EventQueue(true);

      // ---- 箱（床 + 4枚の壁）----
      const HALF_W = 6; // 箱の内寸 半分(X)
      const HALF_D = 4; // 箱の内寸 半分(Z)
      const WALL_H = 1.6; // 透明な箱の縁の高さ
      const WALL_T = 0.2; // 壁の厚み

      // 箱（床+壁）は1つの kinematic 剛体にまとめ、これを傾けることで物理と見た目を完全一致させる。
      const boxBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0),
      );

      const addBoxCollider = (
        px: number,
        py: number,
        pz: number,
        hx: number,
        hy: number,
        hz: number,
      ) => {
        const col = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
          .setTranslation(px, py, pz)
          .setRestitution(0.25)
          .setFriction(0.05) // 床・壁も低摩擦にして玉が滑り続けるように
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        world.createCollider(col, boxBody);
      };

      addBoxCollider(0, -0.5, 0, HALF_W, 0.5, HALF_D); // 床
      addBoxCollider(
        0,
        WALL_H / 2,
        -(HALF_D + WALL_T / 2),
        HALF_W + WALL_T,
        WALL_H / 2,
        WALL_T / 2,
      );
      addBoxCollider(0, WALL_H / 2, HALF_D + WALL_T / 2, HALF_W + WALL_T, WALL_H / 2, WALL_T / 2);
      addBoxCollider(
        -(HALF_W + WALL_T / 2),
        WALL_H / 2,
        0,
        WALL_T / 2,
        WALL_H / 2,
        HALF_D + WALL_T,
      );
      addBoxCollider(HALF_W + WALL_T / 2, WALL_H / 2, 0, WALL_T / 2, WALL_H / 2, HALF_D + WALL_T);

      // ---- 砂浜（箱より広い地面）----
      const sandGeo = new THREE.PlaneGeometry(60, 60);
      const sandMat = new THREE.MeshStandardMaterial({
        color: 0xe3d4b3,
        roughness: 1.0,
        metalness: 0.0,
        envMapIntensity: 0.3,
      });
      const sandMesh = new THREE.Mesh(sandGeo, sandMat);
      sandMesh.rotation.x = -Math.PI / 2;
      sandMesh.position.y = -0.78; // 箱の底面に合わせ、箱が砂浜の上に乗る
      sandMesh.receiveShadow = true;
      scene.add(sandMesh);

      // ---- 透明な箱（ガラス）の見た目 ----
      const glassBoxMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.0,
        metalness: 0.0,
        transmission: 1.0,
        ior: 1.5,
        thickness: 0.4,
        transparent: true,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        envMapIntensity: 1.0,
        side: THREE.DoubleSide,
      });

      const glassGroup = new THREE.Group();
      // 箱の底（砂浜の上に乗るガラス板）。玉の接地面(y=0)より底板の上面を下げて段差を作る。
      const BASE_TOP = -0.35;
      const BASE_THICK = 0.4;
      const baseGeo = new THREE.BoxGeometry(HALF_W * 2, BASE_THICK, HALF_D * 2);
      const baseMesh = new THREE.Mesh(baseGeo, glassBoxMat);
      baseMesh.position.y = BASE_TOP - BASE_THICK / 2;
      baseMesh.receiveShadow = true;
      glassGroup.add(baseMesh);

      const wallGeos: THREE.BoxGeometry[] = [];
      const addGlassWall = (
        px: number,
        py: number,
        pz: number,
        w: number,
        h: number,
        d: number,
      ) => {
        const g = new THREE.BoxGeometry(w, h, d);
        wallGeos.push(g);
        const m = new THREE.Mesh(g, glassBoxMat);
        m.position.set(px, py, pz);
        glassGroup.add(m);
      };
      const wallOuterW = (HALF_W + WALL_T) * 2;
      const wallOuterD = (HALF_D + WALL_T) * 2;
      addGlassWall(0, WALL_H / 2, -(HALF_D + WALL_T / 2), wallOuterW, WALL_H, WALL_T);
      addGlassWall(0, WALL_H / 2, HALF_D + WALL_T / 2, wallOuterW, WALL_H, WALL_T);
      addGlassWall(-(HALF_W + WALL_T / 2), WALL_H / 2, 0, WALL_T, WALL_H, wallOuterD);
      addGlassWall(HALF_W + WALL_T / 2, WALL_H / 2, 0, WALL_T, WALL_H, wallOuterD);
      scene.add(glassGroup);

      // ---- ビー玉 ----
      const RADIUS = 0.5;
      const COUNT = 48;
      const marbleColors = [0x7fb8d8, 0xd88fb0, 0x9fd8a0, 0xe0c878, 0xb89fe0, 0xe89878, 0x88d0d0];

      const sphereGeo = new THREE.SphereGeometry(RADIUS, 24, 16);
      const marbles: Marble[] = [];

      // 床の上にグリッド配置する座標を用意（落下演出はしない）。
      const gridPositions: { x: number; z: number }[] = [];
      const step = RADIUS * 2 + 0.35;
      const edge = RADIUS + 0.1; // 壁からの最小クリアランス
      for (let gx = -HALF_W + edge; gx <= HALF_W - edge + 1e-6; gx += step) {
        for (let gz = -HALF_D + edge; gz <= HALF_D - edge + 1e-6; gz += step) {
          gridPositions.push({ x: gx, z: gz });
        }
      }
      for (let k = gridPositions.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [gridPositions[k], gridPositions[j]] = [gridPositions[j], gridPositions[k]];
      }
      const marbleCount = Math.min(COUNT, gridPositions.length);

      for (let i = 0; i < marbleCount; i++) {
        const color = marbleColors[i % marbleColors.length];
        const mat = new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.0,
          metalness: 0.0,
          transmission: 1.0, // 完全に光を透過 = ガラス
          ior: 1.52,
          thickness: 1.0,
          transparent: true,
          attenuationColor: new THREE.Color(color), // 透過光が玉の色に染まる
          attenuationDistance: 1.5,
          clearcoat: 1.0,
          clearcoatRoughness: 0.0,
          envMapIntensity: 1.2,
        });
        const mesh = new THREE.Mesh(sphereGeo, mat);
        mesh.castShadow = true;
        scene.add(mesh);

        const gp = gridPositions[i];
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(gp.x, RADIUS, gp.z)
            .setLinearDamping(0.08)
            .setCanSleep(false), // 傾きで常に転がるので眠らせない
        );
        const col = RAPIER.ColliderDesc.ball(RADIUS)
          .setRestitution(0.3)
          .setFriction(0.02) // ごく低摩擦 = ガラス玉らしく滑って常に転がる
          .setDensity(1.5)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        world.createCollider(col, body);

        marbles.push({ body, mesh, pitch: 0.8 + Math.random() * 0.5 });
      }

      // collider.handle -> marble の逆引き表（衝突音のピッチ決定用）
      const handleToMarble = new Map<number, Marble>();
      marbles.forEach((m) => {
        handleToMarble.set(m.body.collider(0).handle, m);
      });

      // ---- 「手」: ポインタ位置に追従する見えない kinematic 球 ----
      const handBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -10, 0),
      );
      world.createCollider(RAPIER.ColliderDesc.ball(1.1).setRestitution(0.1), handBody);

      const state: Sim = {
        world,
        eventQueue,
        marbles,
        handleToMarble,
        boxBody,
        handBody,
        glassGroup,
        HALF_W,
        HALF_D,
        handActive: false,
        handTarget: new THREE.Vector3(0, 0.6, 0),
        tiltPhase: 0,
        // 衝突音スロットリング
        soundsThisFrame: 0,
      };

      // ---- ポインタ -> 箱の床面(y=0.6平面)へのレイキャスト ----
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6);
      const hit = new THREE.Vector3();

      const pointerToWorld = (clientX: number, clientY: number): boolean => {
        // canvas の実サイズ基準で NDC を計算（リサイズに正確に追従）。
        const w = sizeRef.current.width;
        const h = sizeRef.current.height;
        ndc.x = (clientX / w) * 2 - 1;
        ndc.y = -(clientY / h) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        if (!raycaster.ray.intersectPlane(planeY, hit)) return false;
        const inside =
          hit.x >= -HALF_W - 0.3 &&
          hit.x <= HALF_W + 0.3 &&
          hit.z >= -HALF_D - 0.3 &&
          hit.z <= HALF_D + 0.3;
        state.handTarget.copy(hit);
        state.handTarget.x = THREE.MathUtils.clamp(state.handTarget.x, -HALF_W, HALF_W);
        state.handTarget.z = THREE.MathUtils.clamp(state.handTarget.z, -HALF_D, HALF_D);
        return inside;
      };

      const onMove = (e: PointerEvent) => {
        // canvas を基準にした座標へ補正（canvas が全画面でない場合にも対応）。
        const rect = gl.domElement.getBoundingClientRect();
        const inside = pointerToWorld(e.clientX - rect.left, e.clientY - rect.top);
        state.handActive = inside;
        if (!inside) {
          handBody.setNextKinematicTranslation({ x: 0, y: -10, z: 0 });
        }
      };
      const onLeave = () => {
        state.handActive = false;
        handBody.setNextKinematicTranslation({ x: 0, y: -10, z: 0 });
      };

      const canvas = gl.domElement;
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerleave", onLeave);
      window.addEventListener("pointerup", onLeave);

      // ---- 後始末（旧 dispose 相当。renderer.dispose は R3F が自動で行うので呼ばない）----
      cleanups.push(() => {
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerleave", onLeave);
        window.removeEventListener("pointerup", onLeave);

        scene.remove(lights, sandMesh, glassGroup);
        marbles.forEach((m) => {
          scene.remove(m.mesh);
          (m.mesh.material as THREE.Material).dispose();
        });
        if (scene.environment === envTexture) scene.environment = null;

        world.free();
        sphereGeo.dispose();
        sandGeo.dispose();
        sandMat.dispose();
        baseGeo.dispose();
        wallGeos.forEach((g) => g.dispose());
        glassBoxMat.dispose();
        envTexture.dispose();
        pmrem.dispose();
      });

      sim.current = state;
      ready.current = true;
    })();

    return () => {
      disposed = true;
      ready.current = false;
      cleanups.forEach((fn) => fn());
      sim.current = null;
    };
    // gl/scene/camera は <Canvas> 内で安定。マウント時1回だけ初期化する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 箱の傾き ----
  // 箱メッシュを物理ごと傾けるのは整合が面倒なので、kinematic 剛体（床+壁）を回転させ、
  // 見た目のガラスも同じだけ傾けて挙動と一致させる。重力は真下のまま。
  const G_TILT = THREE.MathUtils.degToRad(9); // 最大傾き角
  const TILT_SPEED = 0.18; // ゆっくり一周して玉を弾かない
  const boxQuat = useRef(new THREE.Quaternion()).current;
  const boxEuler = useRef(new THREE.Euler()).current;

  useFrame((_, delta) => {
    if (!ready.current) return;
    const s = sim.current!;
    const dt = Math.min(0.05, delta);

    // 傾きをゆっくり回し続ける（手で触っていても止めない）。
    s.tiltPhase += dt * TILT_SPEED;
    const rotX = Math.sin(s.tiltPhase) * G_TILT;
    const rotZ = Math.cos(s.tiltPhase * 0.8) * G_TILT;
    boxEuler.set(rotX, 0, rotZ);
    boxQuat.setFromEuler(boxEuler);
    s.glassGroup.quaternion.copy(boxQuat);
    s.boxBody.setNextKinematicRotation(boxQuat);

    // 手の位置を物理に反映
    if (s.handActive) {
      s.handBody.setNextKinematicTranslation({
        x: s.handTarget.x,
        y: 0.6,
        z: s.handTarget.z,
      });
    }

    s.world.step(s.eventQueue);

    // ---- 衝突音（同時に鳴りすぎ防止）----
    const MAX_SOUNDS_PER_FRAME = 2;
    s.soundsThisFrame = 0;
    s.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      if (s.soundsThisFrame >= MAX_SOUNDS_PER_FRAME) return;

      const m1 = s.handleToMarble.get(h1);
      const m2 = s.handleToMarble.get(h2);
      let speed = 0;
      let pitch = 1.0;
      if (m1) {
        const v = m1.body.linvel();
        speed = Math.max(speed, Math.hypot(v.x, v.y, v.z));
        pitch = m1.pitch;
      }
      if (m2) {
        const v = m2.body.linvel();
        speed = Math.max(speed, Math.hypot(v.x, v.y, v.z));
        if (!m1) pitch = m2.pitch;
      }
      if (speed < 1.5) return; // 弱い接触は無音（ザワつき防止）
      playMarble(Math.min(1, speed / 9), pitch);
      s.soundsThisFrame++;
    });

    // ---- 物理 -> 描画の同期 ----
    for (const m of s.marbles) {
      const t = m.body.translation();
      const r = m.body.rotation();
      m.mesh.position.set(t.x, t.y, t.z);
      m.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      // 箱から飛び出した玉は戻す（保険）
      if (t.y < -5) {
        m.body.setTranslation({ x: 0, y: 5, z: 0 }, true);
        m.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  });

  return null;
}
