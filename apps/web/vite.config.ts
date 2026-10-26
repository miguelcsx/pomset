import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The workbench is a client-side app. It renders evidence the API or the local
// read-only transport supplies; it never analyses, measures or decides
// eligibility itself.
export default defineConfig({
  plugins: [react()],
  define: { __POMSET_WEB_VERSION__: JSON.stringify((JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }).version) },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
