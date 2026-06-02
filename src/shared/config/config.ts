import { z } from "zod";

const DEFAULT_HCM_TIMEOUT_MS = 8000;

const configSchema = z.object({
  HCM_API_URL: z.string().url(),
  HCM_API_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_HCM_TIMEOUT_MS),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]),
});

export type AppConfig = z.infer<typeof configSchema>;

export const config: AppConfig = configSchema.parse({
  HCM_API_URL: process.env.HCM_API_URL,
  HCM_API_TIMEOUT_MS: process.env.HCM_API_TIMEOUT_MS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
});
