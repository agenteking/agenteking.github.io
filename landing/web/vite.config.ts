import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
// Ruta pública del sitio: "/" con Express (default); "/<carpeta>/" en GitHub Pages (BASE_PATH=/<carpeta>/).
const base = `/${(process.env.BASE_PATH ?? "").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");

export default defineConfig({
  root,
  base,
  envDir: fileURLToPath(new URL("..", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../dist/web", import.meta.url)),
    emptyOutDir: true,
    target: "es2022",
    cssCodeSplit: true,
    assetsInlineLimit: 2048,
  },
  server: {
    port: 5174,
    proxy: { "/api": "http://localhost:4320" },
  },
});
