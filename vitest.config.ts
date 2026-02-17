import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["backend/**/*.ts"],
      exclude: [
        "**/dist/**",
        "**/node_modules/**",
        "**/__tests__/**",
        "**/types.ts",
        "**/index.ts",
        "**/*.config.ts",
      ],
    },
  },
});
