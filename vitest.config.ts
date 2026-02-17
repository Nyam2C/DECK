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
      exclude: ["**/dist/**", "**/node_modules/**"],
      // TODO: 테스트 추가 후 임계값 활성화
      // thresholds: { statements: 70, branches: 70, functions: 70, lines: 70 },
    },
  },
});
