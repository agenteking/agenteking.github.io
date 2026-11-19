import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../dist/web", import.meta.url)),
    emptyOutDir: true,
    target: "es2022",
    cssCodeSplit: true,
    assetsInlineLimit: 2048,
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:4310" },
  },
});
