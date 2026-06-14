import { Routes, Route } from "react-router-dom";
import { AudioProvider } from "./audio/AudioContext";
import MenuPage from "./features/menu/MenuPage";
import ScenePage from "./features/scene/ScenePage";

export default function App() {
  return (
    <AudioProvider>
      <div id="app">
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/:sceneId" element={<ScenePage />} />
        </Routes>
      </div>
    </AudioProvider>
  );
}
