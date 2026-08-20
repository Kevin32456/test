import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  server: {
    port: 4317,
    proxy: {
      "/socket.io": {
        target: "http://127.0.0.1:4318",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
