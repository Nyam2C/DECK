import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
  },
  server: {
    watch: {
      usePolling: true,
    },
    proxy: {
      "/ws": {
        target: "ws://127.0.0.1:3000",
        ws: true,
      },
      "/api": {
        target: "http://127.0.0.1:3000",
      },
      "/hook": {
        target: "http://127.0.0.1:3000",
      },
    },
  },
});
