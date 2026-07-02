import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this project under /weblog/.
  base: "/weblog/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    // duckdb-wasm ships its own workers; let Vite leave them alone.
    exclude: ["@duckdb/duckdb-wasm"],
    // Pre-bundle xlsx up front so the dev server doesn't re-optimize mid-session
    // (which was intermittently killing the dev server on first upload).
    include: ["xlsx"],
  },
});
