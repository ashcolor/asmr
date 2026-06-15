import { useParams, useNavigate, Navigate } from "react-router-dom";
import { findScene } from "../../constants/sceneDefs";
import { useAudio } from "../../audio/AudioContext";
import TapToStart from "../../components/TapToStart";

// 各シーンを表示するページ（旧 #hud + <canvas>）。
// URL の :sceneId で表示するシーンを決める。無効・準備中のシーンはメニューへ戻す。
export default function ScenePage() {
  const { sceneId } = useParams();
  const navigate = useNavigate();
  const { audioReady, unlock } = useAudio();

  const def = findScene(sceneId);
  // 存在しない / まだ作っていないシーンへの直アクセスはメニューへ。
  if (!def || !def.enabled || !def.component) {
    return <Navigate to="/" replace />;
  }

  const SceneComponent = def.component;

  return (
    <>
      {/* アクセス時からシーンは見えるように描画する。音はタップ後に有効化する。 */}
      <SceneComponent />

      <header id="hud">
        <button aria-label="メニューに戻る" id="back-btn" onClick={() => navigate("/")}>
          ← もどる
        </button>
        <span id="scene-name">{def.label}</span>
      </header>

      {!audioReady && <TapToStart onTap={unlock} />}
    </>
  );
}
