import { z } from "zod";

const DEFAULT_HCM_TIMEOUT_MS = 8000;
const DEFAULT_HCM_API_URL = "http://localhost:3000/api/hcm";
const DEFAULT_APP_ENV = "development";

const configSchema = z.object({
  HCM_API_URL: z.string().url(),
  HCM_API_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_HCM_TIMEOUT_MS),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]),
});

export type AppConfig = z.infer<typeof configSchema>;

/**
 * The mock HCM is co-located (`/api/hcm`) and the browser talks to it with relative
 * paths, so `HCM_API_URL` is a placeholder that defaults to the local mock - the build
 * must not hard-fail when it is unset (CI / Vercel prerender `/employee` without a .env).
 * The schema still validates the *shape* if a value is provided. Point it at a real HCM
 * by setting `HCM_API_URL` explicitly; in that case a deploy would reinstate strict checks.
 */
export const config: AppConfig = configSchema.parse({
  HCM_API_URL: process.env.HCM_API_URL ?? DEFAULT_HCM_API_URL,
  HCM_API_TIMEOUT_MS:
    process.env.HCM_API_TIMEOUT_MS ??
    process.env.NEXT_PUBLIC_HCM_API_TIMEOUT_MS,
  NEXT_PUBLIC_APP_ENV:
    process.env.NEXT_PUBLIC_APP_ENV ?? DEFAULT_APP_ENV,
});
