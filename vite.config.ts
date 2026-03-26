import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 运行时
          "vendor-react": ["react", "react-dom"],
          // CodeMirror（最大的单个依赖）
          "vendor-codemirror": [
            "@codemirror/lang-markdown",
            "@codemirror/theme-one-dark",
            "@uiw/react-codemirror",
          ],
          // Lucide 图标库
          "vendor-lucide": ["lucide-react"],
          // Zustand 状态管理
          "vendor-zustand": ["zustand"],
        },
      },
    },
  },
}));
