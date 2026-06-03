import { nanoid } from "nanoid";
import type { ZodType } from "zod";
import {
  createHCMError,
  HCM_ERROR_CODE,
  isHCMError,
  parseHCMErrorBody,
  type HCMError,
} from "@/shared/api/errors";
import {
  MOCK_AUTH_HEADER,
  MOCK_AUTH_VALUE,
} from "@/shared/constants/mockAuth";
import { config } from "@/shared/config/config";

type HcmMethod = "GET" | "POST" | "PATCH";

type HcmFetchOptions<T> = {
  method?: HcmMethod;
  body?: unknown;
  schema: ZodType<T>;
};

function buildUrl(path: string): string {
  if (typeof window !== "undefined") {
    return path;
  }

  const origin = new URL(config.HCM_API_URL).origin;
  return `${origin}${path}`;
}

async function parseErrorResponse(response: Response): Promise<HCMError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = parseHCMErrorBody(body);

  if (parsed) {
    return parsed;
  }

  return createHCMError({
    code: HCM_ERROR_CODE.UNKNOWN,
    message: `HCM request failed with status ${response.status}`,
    retryable: response.status >= 500,
  });
}

export async function hcmFetch<T>(
  path: string,
  options: HcmFetchOptions<T>,
): Promise<T> {
  const method = options.method ?? "GET";
  const controller = new AbortController();
  const timeoutMs = config.HCM_API_TIMEOUT_MS;
  // Flag the abort cause ourselves — the thrown error's shape varies by runtime
  // (DOMException vs TypeError), so we cannot reliably sniff it after the fact.
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-request-id": nanoid(),
        [MOCK_AUTH_HEADER]: MOCK_AUTH_VALUE,
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    const json: unknown = await response.json();
    return options.schema.parse(json);
  } catch (error) {
    if (isHCMError(error)) {
      throw error;
    }

    if (
      didTimeout ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw createHCMError({
        code: HCM_ERROR_CODE.TIMEOUT,
        message: "HCM request timed out",
        retryable: true,
      });
    }

    throw createHCMError({
      code: HCM_ERROR_CODE.NETWORK,
      message: "HCM network error",
      retryable: true,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function hcmGet<T>(path: string, schema: ZodType<T>): Promise<T> {
  return hcmFetch(path, { schema });
}

export function hcmPost<T>(
  path: string,
  body: unknown,
  schema: ZodType<T>,
): Promise<T> {
  return hcmFetch(path, { method: "POST", body, schema });
}

export function hcmPatch<T>(
  path: string,
  body: unknown,
  schema: ZodType<T>,
): Promise<T> {
  return hcmFetch(path, { method: "PATCH", body, schema });
}
