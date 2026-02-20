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
      include: ["backend/**/*.ts", "frontend/src/**/*.ts", "frontend/src/**/*.tsx"],
      exclude: [
        "**/dist/**",
        "**/node_modules/**",
        "**/__tests__/**",
        "**/types.ts",
        "**/index.ts",
        "**/*.config.ts",
        "frontend/src/main.tsx",
        "frontend/src/vite-env.d.ts",
        "frontend/src/App.tsx",
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
