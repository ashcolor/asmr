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
}

interface Sim {
  world: RAPIER.World;
  eventQueue: RAPIER.EventQueue;
  // spawnMarble のクロージャと同一参照を共有する。再代入すると共有が切れて
  // 投げ入れた玉が同期されなくなるため readonly で差し替えを禁止する（splice/push は可）。
  readonly marbles: Marble[];
  handleToMarble: Map<number, Marble>;
  boxBody: RAPIER.RigidBody;
  handBody: RAPIER.RigidBody;
  glassGroup: THREE.Group;
  sandMat: THREE.MeshStandardMaterial;
  HALF_W: number;
  HALF_D: number;
  handActive: boolean;
  handTarget: THREE.Vector3;
  tiltPhase: number;
  // 初期玉を1個ずつ上から落とすためのキューと投入タイマー。
  spawnQueue: { x: number; z: number }[];
  dropY: number;
  dropTimer: number;
  spawnMarble: (
    x: number,
    y: number,
    z: number,
    vel?: { x: number; y: number; z: number },
  ) => Marble;
}

interface MarblesProps {
  // 砂浜の明るさ（テクスチャ色への乗算倍率）。1=元のテクスチャそのまま。
  sandBrightness?: number;
}

export default function Marbles({ sandBrightness = 1 }: MarblesProps) {
  const { scene, camera, gl } = useThree();
  const sim = useRef<Sim | null>(null); // 物理・メッシュ一式（初期化後にセット）
  const ready = useRef(false);
  // 毎フレーム読む明るさ。再レンダリングせず最新値を useFrame に渡すため ref に保持。
  const sandBrightnessRef = useRef(sandBrightness);
  sandBrightnessRef.current = sandBrightness;

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
      // sigma を 0 にしてぼかさず、鮮明な映り込み（ハイライトのコントラスト）を残す。
      const pmrem = new THREE.PMREMGenerator(gl);
      pmrem.compileEquirectangularShader();
      const envTexture = pmrem.fromScene(new RoomEnvironment(), 0).texture;
      scene.environment = envTexture;
      // 環境光をシーン全体に薄く効かせ、ガラス越しの空気感を均一にする。
      scene.environmentIntensity = 0.9;

      // ---- ライティング ----
      // 海辺の明るい昼下がり。空(水色)と砂浜(暖色)からの光で柔らかく照らす。
      // 露出(0.85)を上げたぶん各ライトはやや控えめにし、key を主役にしてコントラストを出す。
      const lights = new THREE.Group();
      const hemi = new THREE.HemisphereLight(0xdff0ff, 0xfff0d8, 0.55);
      lights.add(hemi);
      lights.add(new THREE.AmbientLight(0xffffff, 0.12));
      const key = new THREE.DirectionalLight(0xfff6ea, 1.5); // 陽射し（主光源）
      key.position.set(6, 14, 6);
      key.castShadow = true;
      // 影解像度を上げ、radius でペナンブラ(半影)を作って柔らかいリアルな影にする。
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -12;
      key.shadow.camera.right = 12;
      key.shadow.camera.top = 12;
      key.shadow.camera.bottom = -12;
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 60;
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.02;
      key.shadow.radius = 4;
      lights.add(key);
      const fill = new THREE.DirectionalLight(0xbfe0ff, 0.3); // 空の照り返し
      fill.position.set(-6, 8, -4);
      lights.add(fill);
      // 玉のハイライトを締めるリムライト（背後・低め）。輪郭にキラッと光が回る。
      const rim = new THREE.DirectionalLight(0xffffff, 0.5);
      rim.position.set(-4, 6, -8);
      lights.add(rim);
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
      // 砂のテクスチャ(public/textures/sand.png)を繰り返しタイルで貼る。
      // 明るさはマテリアルの color（テクスチャに乗算される倍率）で制御し、
      // 毎フレーム brightnessRef を反映してスライダーから調整できるようにする。
      const sandGeo = new THREE.PlaneGeometry(60, 60);
      const sandTex = new THREE.TextureLoader().load("/textures/sand.png");
      sandTex.colorSpace = THREE.SRGBColorSpace;
      sandTex.wrapS = THREE.RepeatWrapping;
      sandTex.wrapT = THREE.RepeatWrapping;
      sandTex.repeat.set(6, 6); // 60x60 を 6 回繰り返す = 1 タイル 10 単位
      sandTex.anisotropy = gl.capabilities.getMaxAnisotropy();
      const sandMat = new THREE.MeshStandardMaterial({
        map: sandTex,
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
        color: 0xfbfeff,
        roughness: 0.0,
        metalness: 0.0,
        transmission: 1.0,
        ior: 1.5,
        thickness: 0.08,
        transparent: true,
        opacity: 0.15,
        attenuationColor: new THREE.Color(0xf2fbff),
        attenuationDistance: 8.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        envMapIntensity: 2.6, // 縁のエッジに光が回り、ガラスの箱らしい映り込みを強める
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const glassGroup = new THREE.Group();
      const wallOuterW = (HALF_W + WALL_T) * 2;
      const wallOuterD = (HALF_D + WALL_T) * 2;
      // 箱の底。上面を側面の下端(y=0)に合わせ、外寸も側面まで伸ばして隙間をなくす。
      const BASE_TOP = 0;
      const BASE_THICK = 0.4;
      const baseGeo = new THREE.BoxGeometry(wallOuterW, BASE_THICK, wallOuterD);
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
      addGlassWall(0, WALL_H / 2, -(HALF_D + WALL_T / 2), wallOuterW, WALL_H, WALL_T);
      addGlassWall(0, WALL_H / 2, HALF_D + WALL_T / 2, wallOuterW, WALL_H, WALL_T);
      addGlassWall(-(HALF_W + WALL_T / 2), WALL_H / 2, 0, WALL_T, WALL_H, wallOuterD);
      addGlassWall(HALF_W + WALL_T / 2, WALL_H / 2, 0, WALL_T, WALL_H, wallOuterD);
      scene.add(glassGroup);

      // ---- ビー玉 ----
      const RADIUS = 0.5;
      const COUNT = 48;
      const marbleColors = [0x9fdcff, 0xffb8d2, 0xb8ffc7, 0xffe68a, 0xd5c2ff, 0xffc0a6, 0xb5ffff];

      const sphereGeo = new THREE.SphereGeometry(RADIUS, 40, 28);
      const marbles: Marble[] = [];
      // collider.handle -> marble の逆引き表（衝突音のピッチ決定用）
      const handleToMarble = new Map<number, Marble>();
      let colorIndex = 0;

      // 1個の玉を生成してワールド・シーン・配列に登録する共通関数。
      // 初期配置（速度ゼロ）とクリック投げ入れ（初速あり）で共用する。
      const spawnMarble = (
        x: number,
        y: number,
        z: number,
        vel?: { x: number; y: number; z: number },
      ): Marble => {
        const color = marbleColors[colorIndex++ % marbleColors.length];
        const tint = new THREE.Color(color);
        // 表面色は白寄せして透明感を出す。色は主に attenuation（ガラス内部の吸収）で付ける。
        const surfaceColor = tint.clone().lerp(new THREE.Color(0xffffff), 0.65);
        const mat = new THREE.MeshPhysicalMaterial({
          color: surfaceColor,
          roughness: 0.0, // 鏡面に近い完全な滑らかさ＝澄んだガラス
          metalness: 0.0,
          transmission: 1.0, // 完全に光を透過 = ガラス
          ior: 1.52, // クラウンガラス相当の屈折率
          // 玉の直径ぶん厚みを持たせ、屈折・吸収がしっかり効くようにする。
          thickness: RADIUS * 2,
          transparent: true,
          opacity: 1.0, // transmission が透け感を担うので opacity は下げない（暗くならない）
          attenuationColor: tint, // ガラス内部を通る光が色づく（奥ほど濃く）
          attenuationDistance: 1.4, // 短いほど色が濃く出る
          clearcoat: 1.0, // 表面にもう一層のニス膜＝強いハイライト
          clearcoatRoughness: 0.0,
          dispersion: 1.2, // 色収差（プリズム的な虹色のにじみ）でガラスらしさを増す
          reflectivity: 0.7,
          envMapIntensity: 2.4, // 環境の映り込みを強めて立体感を出す
        });
        const mesh = new THREE.Mesh(sphereGeo, mat);
        mesh.castShadow = true;
        scene.add(mesh);

        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y, z)
            .setLinearDamping(0.08)
            .setCcdEnabled(true) // 高所から落ちても床を貫通(トンネリング)しない
            .setCanSleep(false), // 傾きで常に転がるので眠らせない
        );
        if (vel) body.setLinvel(vel, true);
        const col = RAPIER.ColliderDesc.ball(RADIUS)
          .setRestitution(0.3)
          .setFriction(0.02) // ごく低摩擦 = ガラス玉らしく滑って常に転がる
          .setDensity(1.5)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        world.createCollider(col, body);

        const marble: Marble = { body, mesh };
        marbles.push(marble);
        handleToMarble.set(body.collider(0).handle, marble);
        return marble;
      };

      const spawnMarbleAtPointer = (point: THREE.Vector3): Marble => {
        const edge = RADIUS + 0.12;
        const invBoxQuat = boxQuat.clone().invert();
        const local = point.clone().applyQuaternion(invBoxQuat);
        const safeLocal = new THREE.Vector3(
          THREE.MathUtils.clamp(local.x, -HALF_W + edge, HALF_W - edge),
          RADIUS + 0.12,
          THREE.MathUtils.clamp(local.z, -HALF_D + edge, HALF_D - edge),
        );

        const minSep = RADIUS * 2 + 0.04;
        const minSepSq = minSep * minSep;
        const otherLocal = new THREE.Vector3();
        for (let pass = 0; pass < marbles.length + 1; pass++) {
          let movedUp = false;
          for (const marble of marbles) {
            const t = marble.body.translation();
            otherLocal.set(t.x, t.y, t.z).applyQuaternion(invBoxQuat);
            const dx = safeLocal.x - otherLocal.x;
            const dz = safeLocal.z - otherLocal.z;
            const horizontalSq = dx * dx + dz * dz;
            if (horizontalSq >= minSepSq) continue;

            const requiredY = otherLocal.y + Math.sqrt(minSepSq - horizontalSq);
            if (safeLocal.y < requiredY) {
              safeLocal.y = requiredY;
              movedUp = true;
            }
          }
          if (!movedUp) break;
        }

        const spawnPoint = safeLocal.applyQuaternion(boxQuat);

        return spawnMarble(spawnPoint.x, spawnPoint.y, spawnPoint.z);
      };

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

      // 初期玉は一括で置かず、useFrame から一定間隔で1個ずつ「上から落とす」。
      // 落下位置は従来のグリッド座標を流用し、床のすぐ上ではなく高い位置から落とす。
      const DROP_Y = WALL_H + RADIUS + 2; // 箱の縁より上から落とす
      const spawnQueue: { x: number; z: number }[] = gridPositions.slice(0, marbleCount);

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
        sandMat,
        HALF_W,
        HALF_D,
        handActive: false,
        handTarget: new THREE.Vector3(0, 0.6, 0),
        tiltPhase: 0,
        spawnQueue,
        dropY: DROP_Y,
        dropTimer: 0,
        spawnMarble,
      };

      // ---- ポインタ -> 箱の床面(y=0.6平面)へのレイキャスト ----
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const pointerPlane = new THREE.Plane();
      const pointerPlaneNormal = new THREE.Vector3();
      const pointerPlanePoint = new THREE.Vector3();
      const hit = new THREE.Vector3();
      const localHit = new THREE.Vector3();
      const clampedLocalHit = new THREE.Vector3();

      const pointerHit = (
        clientX: number,
        clientY: number,
        viewW: number,
        viewH: number,
      ): THREE.Vector3 | null => {
        if (viewW <= 0 || viewH <= 0) return null;
        ndc.x = (clientX / viewW) * 2 - 1;
        ndc.y = -(clientY / viewH) * 2 + 1;
        camera.updateMatrixWorld();
        raycaster.setFromCamera(ndc, camera);
        pointerPlaneNormal.set(0, 1, 0).applyQuaternion(boxQuat);
        pointerPlanePoint.set(0, 0.6, 0).applyQuaternion(boxQuat);
        pointerPlane.setFromNormalAndCoplanarPoint(pointerPlaneNormal, pointerPlanePoint);
        if (!raycaster.ray.intersectPlane(pointerPlane, hit)) return null;
        localHit.copy(hit).applyQuaternion(boxQuat.clone().invert());
        const inside =
          localHit.x >= -HALF_W - 0.3 &&
          localHit.x <= HALF_W + 0.3 &&
          localHit.z >= -HALF_D - 0.3 &&
          localHit.z <= HALF_D + 0.3;
        if (!inside) return null;
        clampedLocalHit.set(
          THREE.MathUtils.clamp(localHit.x, -HALF_W, HALF_W),
          0.6,
          THREE.MathUtils.clamp(localHit.z, -HALF_D, HALF_D),
        );
        return clampedLocalHit.clone().applyQuaternion(boxQuat);
      };

      const pointerToWorld = (clientX: number, clientY: number): boolean => {
        const rect = gl.domElement.getBoundingClientRect();
        const point = pointerHit(clientX, clientY, rect.width, rect.height);
        if (!point) return false;
        state.handTarget.copy(point);
        return true;
      };

      const onLeave = () => {
        state.handActive = false;
        handBody.setTranslation({ x: 0, y: -10, z: 0 }, true);
        handBody.setNextKinematicTranslation({ x: 0, y: -10, z: 0 });
      };

      // ---- クリックでビー玉を投げ入れる ----
      // 押した位置とほぼ同じ位置で離した「タップ」だけを投げ入れと判定し、
      // ドラッグ（手で混ぜる）と区別する。
      let downX = 0;
      let downY = 0;
      let downTime = 0;
      let downButton = -1;
      let downSpawnTarget: THREE.Vector3 | null = null;
      let pointerDown = false;
      let draggingHand = false;

      const hideHand = () => {
        state.handActive = false;
        handBody.setTranslation({ x: 0, y: -10, z: 0 }, true);
        handBody.setNextKinematicTranslation({ x: 0, y: -10, z: 0 });
      };

      const onDown = (e: PointerEvent) => {
        downX = e.clientX;
        downY = e.clientY;
        downTime = performance.now();
        downButton = e.button;
        pointerDown = e.button === 0;
        draggingHand = false;
        hideHand();
        const rect = gl.domElement.getBoundingClientRect();
        downSpawnTarget = pointerHit(
          e.clientX - rect.left,
          e.clientY - rect.top,
          rect.width,
          rect.height,
        );
      };
      const onUp = (e: PointerEvent) => {
        const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
        const heldMs = performance.now() - downTime;
        // 左ボタンで、ほとんど動かず短時間で離した = タップ。投げ入れる。
        // （右ドラッグは視点移動なので投げ入れない。）
        if (downSpawnTarget && downButton === 0 && moved < 12 && heldMs < 400) {
          // 初期配置と同じ入り方にする: クリック位置の床のすぐ上に初速ゼロで置く。
          // あとは箱の傾きで他の玉と一緒に自然に転がって馴染む。
          // 位置は pointerdown 時点の安定したヒット位置を使う。
          hideHand();
          spawnMarbleAtPointer(downSpawnTarget);
        }
        pointerDown = false;
        draggingHand = false;
        downSpawnTarget = null;
        hideHand();
      };

      const onDragMove = (e: PointerEvent) => {
        const rect = gl.domElement.getBoundingClientRect();
        const inside = pointerToWorld(e.clientX - rect.left, e.clientY - rect.top);
        const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
        const heldMs = performance.now() - downTime;
        draggingHand ||= pointerDown && downButton === 0 && (moved >= 12 || heldMs >= 400);
        state.handActive = inside && draggingHand;
        if (!state.handActive) {
          handBody.setNextKinematicTranslation({ x: 0, y: -10, z: 0 });
        }
      };

      const canvas = gl.domElement;
      canvas.addEventListener("pointermove", onDragMove);
      canvas.addEventListener("pointerleave", onLeave);
      canvas.addEventListener("pointerdown", onDown);
      window.addEventListener("pointerup", onUp);

      // ---- 後始末（旧 dispose 相当。renderer.dispose は R3F が自動で行うので呼ばない）----
      cleanups.push(() => {
        canvas.removeEventListener("pointermove", onDragMove);
        canvas.removeEventListener("pointerleave", onLeave);
        canvas.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerup", onUp);

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
        sandTex.dispose();
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
  const TILT_SPEED = 0.42; // 箱の自動移動を少し早めに
  const DROP_INTERVAL = 0.12; // 初期玉を1個ずつ落とす間隔(秒)
  const boxQuat = useRef(new THREE.Quaternion()).current;
  const boxEuler = useRef(new THREE.Euler()).current;

  useFrame((_, delta) => {
    if (!ready.current) return;
    const s = sim.current!;
    const dt = Math.min(0.05, delta);

    // 砂浜の明るさをスライダーの最新値に追従させる（color はテクスチャへの乗算倍率）。
    const b = sandBrightnessRef.current;
    s.sandMat.color.setScalar(b);

    // 傾きをゆっくり回し続ける（手で触っていても止めない）。
    s.tiltPhase += dt * TILT_SPEED;
    const rotX = Math.sin(s.tiltPhase) * G_TILT;
    const rotZ = Math.cos(s.tiltPhase * 0.8) * G_TILT;
    boxEuler.set(rotX, 0, rotZ);
    boxQuat.setFromEuler(boxEuler);
    s.glassGroup.quaternion.copy(boxQuat);
    s.boxBody.setNextKinematicRotation(boxQuat);

    // 初期玉を一定間隔で1個ずつ上から落とす。
    if (s.spawnQueue.length > 0) {
      s.dropTimer -= dt;
      if (s.dropTimer <= 0) {
        const gp = s.spawnQueue.shift()!;
        s.spawnMarble(gp.x, s.dropY, gp.z);
        s.dropTimer = DROP_INTERVAL;
      }
    }

    // 手の位置を物理に反映
    if (s.handActive) {
      s.handBody.setNextKinematicTranslation({
        x: s.handTarget.x,
        y: s.handTarget.y,
        z: s.handTarget.z,
      });
    }

    s.world.step(s.eventQueue);

    // ---- 衝突音 ----
    // サンプルが短いので衝突のたびに鳴らす。鳴りすぎ抑制は audio 側の同時発音数上限に任せ、
    // ここでは弱すぎる接触だけ無音にしてザワつきを防ぐ。
    s.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;

      const m1 = s.handleToMarble.get(h1);
      const m2 = s.handleToMarble.get(h2);
      let speed = 0;
      if (m1) {
        const v = m1.body.linvel();
        speed = Math.max(speed, Math.hypot(v.x, v.y, v.z));
      }
      if (m2) {
        const v = m2.body.linvel();
        speed = Math.max(speed, Math.hypot(v.x, v.y, v.z));
      }
      if (speed < 0.2) return; // 弱い接触は無音（ザワつき防止）
      playMarble(Math.min(1, speed / 9));
    });

    // ---- 物理 -> 描画の同期 ----
    // marbles は spawnMarble のクロージャと共有している同一配列なので、再代入せず
    // splice で in-place に詰める。再代入すると投げ入れた玉が同期対象から外れてしまう。
    for (let i = s.marbles.length - 1; i >= 0; i--) {
      const m = s.marbles[i];
      const t = m.body.translation();
      const r = m.body.rotation();
      m.mesh.position.set(t.x, t.y, t.z);
      m.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      // 飛んでいった玉はそのまま（自動補充しない）。遠くまで落ちたら物理から除去。
      if (t.y < -40) {
        s.handleToMarble.delete(m.body.collider(0).handle);
        s.world.removeRigidBody(m.body);
        scene.remove(m.mesh);
        (m.mesh.material as THREE.Material).dispose();
        s.marbles.splice(i, 1);
      }
    }
  });

  return null;
}
