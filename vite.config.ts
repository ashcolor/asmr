import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // rapier3d-compat は wasm を base64 で内包しているので特別な設定は不要だが、
  // 念のため最適化から除外して初期化エラーを避ける。
  optimizeDeps: {
    exclude: ["@dimforge/rapier3d-compat"],
  },
  server: {
    host: true,
  },
});
