import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `vite build --mode artifact` produces one self-contained HTML file (fonts
// inlined) for publishing as a claude.ai Artifact. The normal build is a
// regular multi-file app served by server/index.ts.
export default defineConfig(({ mode }) => {
  const artifact = mode === "artifact";
  return {
    plugins: artifact ? [react(), viteSingleFile()] : [react()],
    define: {
      __ARTIFACT__: JSON.stringify(artifact),
    },
    build: artifact
      ? { outDir: "dist-artifact", assetsInlineLimit: 100_000_000 }
      : { outDir: "dist" },
    server: {
      proxy: { "/api": "http://localhost:8787" },
    },
  };
});
