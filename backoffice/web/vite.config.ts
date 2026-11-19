import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// Back office: se sirve SOLO desde su Express (detrás del login). No va a GitHub Pages.
export default defineConfig({
  root,
  base: "/",
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../dist/web", import.meta.url)),
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 2048,
  },
  server: {
    port: 5175,
    proxy: {
      "/api": "http://localhost:4460",
      "/login": "http://localhost:4460",
      "/logout": "http://localhost:4460",
    },
  },
});
