import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `vite build --mode artifact` produces one self-contained HTML file (fonts
// inlined) for publishing as a claude.ai Artifact. `--mode pages` is the
// static public website (GitHub Pages): relative paths, no API server. The
// normal build is a regular multi-file app served by server/index.ts.
export default defineConfig(({ mode }) => {
  const artifact = mode === "artifact";
  const pages = mode === "pages";
  return {
    base: pages ? "./" : "/",
    plugins: artifact ? [react(), viteSingleFile()] : [react()],
    define: {
      __ARTIFACT__: JSON.stringify(artifact),
      __STATIC__: JSON.stringify(pages),
    },
    build: artifact
      ? { outDir: "dist-artifact", assetsInlineLimit: 100_000_000 }
      : { outDir: pages ? "dist-pages" : "dist" },
    server: {
      proxy: { "/api": "http://localhost:8787" },
    },
  };
});
