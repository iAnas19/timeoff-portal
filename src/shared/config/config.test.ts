import { describe, expect, it, vi } from "vitest";

// config.ts parses env at module-eval, so each case resets modules and re-imports.
describe("config", () => {
  it("uses the provided env values (vitest env)", async () => {
    vi.resetModules();
    const { config } = await import("@/shared/config/config");
    expect(config.HCM_API_URL).toBe("http://localhost:3000");
    expect(config.HCM_API_TIMEOUT_MS).toBe(2000);
    expect(config.NEXT_PUBLIC_APP_ENV).toBe("development");
  });

  it("falls back to safe defaults when env vars are unset", async () => {
    const saved = { ...process.env };
    delete process.env.HCM_API_URL;
    delete process.env.HCM_API_TIMEOUT_MS;
    delete process.env.NEXT_PUBLIC_HCM_API_TIMEOUT_MS;
    delete process.env.NEXT_PUBLIC_APP_ENV;
    vi.resetModules();
    try {
      const { config } = await import("@/shared/config/config");
      expect(config.HCM_API_URL).toBe("http://localhost:3000/api/hcm");
      expect(config.HCM_API_TIMEOUT_MS).toBe(8000);
      expect(config.NEXT_PUBLIC_APP_ENV).toBe("development");
    } finally {
      process.env = saved;
      vi.resetModules();
    }
  });
});
