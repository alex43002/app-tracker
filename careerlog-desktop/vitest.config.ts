import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    env: {
      VITE_API_BASE_URL: "http://127.0.0.1:8000",
    },
  },
});
