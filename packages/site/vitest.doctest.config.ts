import { defineConfig } from "vitest/config";

// The doc tests: scripts/doctest.ts writes them to .doctest/ from the code blocks of the docs.
export default defineConfig({
  test: {
    include: [".doctest/**/*.test.ts"],
  },
});
