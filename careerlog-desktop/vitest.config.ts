import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    env: {
      VITE_API_BASE_URL: "http://127.0.0.1:8000",
    },
    coverage: {
      provider: "v8",
      // Count every source file, not just the ones a test imported, so the
      // reported coverage reflects the whole renderer (untested pages included).
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/test/**",
        "src/types/**", // type-only declarations
        "src/main.tsx", // bootstrap entry
        "src/vite-env.d.ts",
      ],
      // Cobertura for GitHub Code Quality upload; text-summary for local runs.
      reporter: ["text-summary", "cobertura"],
      reportsDirectory: "coverage",
    },
  },
});
