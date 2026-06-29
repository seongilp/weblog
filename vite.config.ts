import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
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
  },
  server: {
    headers: {
      // Enables SharedArrayBuffer so duckdb-wasm can use its threaded build.
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
