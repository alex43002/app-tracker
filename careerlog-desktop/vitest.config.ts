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
      // reported number reflects the whole renderer (untested pages included).
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/test/**",
        "src/types/**", // type-only declarations
        "src/main.tsx", // bootstrap entry
        "src/vite-env.d.ts",
      ],
      // text-summary for the console + CI step summary; html for the uploaded
      // artifact; json-summary is machine-readable for the summary script.
      reporter: ["text-summary", "text", "html", "json-summary"],
      reportsDirectory: "coverage",
      // Floors set just under today's numbers (young suite: ~24% lines, lower
      // branch/function coverage). They guard against regressions now; raise
      // them as component/page tests grow (AUD-21).
      thresholds: {
        statements: 20,
        branches: 10,
        functions: 12,
        lines: 20,
      },
    },
  },
});
