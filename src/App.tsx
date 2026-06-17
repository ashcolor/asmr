import { Routes, Route } from "react-router-dom";
import { AudioProvider } from "./audio/AudioContext";
import MenuPage from "./features/menu/MenuPage";
import ScenePage from "./features/scene/ScenePage";

export default function App() {
  return (
    <AudioProvider>
      <div
        id="app"
        data-theme="dark"
        className="relative h-full w-full overflow-hidden bg-base-100 text-base-content"
      >
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/:sceneId" element={<ScenePage />} />
        </Routes>
      </div>
    </AudioProvider>
  );
}
