import { defineConfig } from "vitest/config";

// The speed lane. Node runs the TypeScript source as native ESM (type stripping), so the module runner of Vite
// adds no getter to each import.
export default defineConfig({
  test: {
    experimental: { viteModuleRunner: false, nodeLoader: false },
    benchmark: { include: ["bench/**/*.bench.ts"] },
  },
});
