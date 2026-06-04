import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    pool: "threads",
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.stories.tsx",
        "src/tests/**",
        "src/app/**", // thin route/page shells — exercised by e2e, not unit
        "src/**/*.d.ts",
      ],
    },
    env: {
      HCM_API_URL: "http://localhost:3000",
      HCM_API_TIMEOUT_MS: "2000",
      NEXT_PUBLIC_APP_ENV: "development",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
