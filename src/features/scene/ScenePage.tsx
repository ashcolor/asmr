import { useParams, useNavigate, Navigate } from "react-router-dom";
import { findScene, sceneDefs } from "../../constants/sceneDefs";
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

      <header id="hud" className="absolute inset-x-0 top-0 z-10">
        <div className="navbar min-h-0 bg-transparent px-2 py-2 sm:px-4">
          {/* 左端: ハンバーガーメニュー（シーン一覧のドロップダウン） */}
          <div className="navbar-start">
            <div className="dropdown">
              <div
                tabIndex={0}
                role="button"
                aria-label="メニューを開く"
                className="btn btn-ghost btn-sm btn-square"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </div>
              <ul
                tabIndex={0}
                className="menu dropdown-content menu-sm z-20 mt-2 w-52 rounded-box bg-base-200 p-2 shadow"
              >
                <li>
                  <button type="button" onClick={() => navigate("/")}>
                    🏠 メニューへ
                  </button>
                </li>
                <li className="menu-title">シーン</li>
                {sceneDefs.map((d) => (
                  <li key={d.name} className={d.enabled ? "" : "menu-disabled"}>
                    <button
                      type="button"
                      disabled={!d.enabled}
                      className={d.name === def.name ? "active" : ""}
                      onClick={d.enabled ? () => navigate(`/${d.name}`) : undefined}
                    >
                      <span>{d.emoji}</span>
                      {d.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 中央: 開いているページの名前 */}
          <div className="navbar-center">
            <span id="scene-name" className="text-sm tracking-widest sm:text-base">
              {def.label}
            </span>
          </div>

          {/* 右端: 左右バランス用の空ブロック（navbar-center を中央に保つ） */}
          <div className="navbar-end" />
        </div>
      </header>

      {!audioReady && <TapToStart onTap={unlock} />}
    </>
  );
}
