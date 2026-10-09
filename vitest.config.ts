import { defineConfig } from "vitest/config";

// The coverage run of the workspace: the tests of each package count toward the coverage of @mark1russell7/vex.
export default defineConfig({
  test: {
    projects: ["packages/core", "packages/domains", "packages/testkit", "packages/pilots"],
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts"],
      exclude: ["**/*.test.ts", "packages/core/src/test-support.ts"],
      reporter: ["text-summary", "text", "json-summary"],
      reportsDirectory: "coverage",
      // The thresholds of lag (docs/REVIEW.md §8.2). A run under them fails.
      thresholds: { statements: 98, branches: 96, functions: 98, lines: 98 },
    },
  },
});
