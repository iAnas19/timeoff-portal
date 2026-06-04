import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Forks (separate processes) instead of worker threads: the suite mounts many
    // jsdom + React Query (polling) + MSW environments, and under that memory
    // pressure a worker thread can crash and cascade into "failed to find the
    // current suite" (zeroing the whole run). Process isolation is the reliable fix.
    pool: "forks",
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
        "src/mocks/browser.ts", // MSW setupWorker — browser-only glue, can't run in Node
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
