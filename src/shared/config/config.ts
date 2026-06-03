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
 * Server-only vars (HCM_API_URL) are not inlined in the browser bundle.
 * On the client, hcmFetch uses relative paths — HCM_API_URL is a parse placeholder only.
 * Server startup still requires HCM_API_URL in .env.
 */
const isBrowser = typeof window !== "undefined";

export const config: AppConfig = configSchema.parse({
  HCM_API_URL:
    process.env.HCM_API_URL ?? (isBrowser ? DEFAULT_HCM_API_URL : undefined),
  HCM_API_TIMEOUT_MS:
    process.env.HCM_API_TIMEOUT_MS ??
    process.env.NEXT_PUBLIC_HCM_API_TIMEOUT_MS,
  NEXT_PUBLIC_APP_ENV:
    process.env.NEXT_PUBLIC_APP_ENV ?? DEFAULT_APP_ENV,
});
