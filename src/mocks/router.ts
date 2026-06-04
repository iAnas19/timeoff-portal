import { NextResponse } from "next/server";
import { z } from "zod";
import { createHCMError, HCM_ERROR_CODE } from "@/shared/api/errors";
import {
  balanceWriteInputSchema,
  patchTimeOffRequestInputSchema,
  submitTimeOffRequestInputSchema,
} from "@/shared/hcm/schemas";
import {
  applySlowDelayIfArmed,
  armConflict,
  armSilentFail,
  armSlow,
  createRequest,
  enforceWriteRateLimit,
  getBatch,
  getCell,
  getPendingApprovals,
  isStoreRouteError,
  listRequests,
  patchRequest,
  resetStore,
  simulateAnniversary,
  writeCell,
} from "@/mocks/store";

import {
  MOCK_AUTH_HEADER,
  MOCK_AUTH_VALUE,
  MOCK_AUTH_HEADERS,
} from "@/shared/constants/mockAuth";

export { MOCK_AUTH_HEADER, MOCK_AUTH_VALUE, MOCK_AUTH_HEADERS };

const HCM_PREFIX = "/api/hcm";

// Explicit CORS allowlist — the dev app and Storybook. No wildcard origins.
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:6006",
  "http://127.0.0.1:3000",
]);
const ALLOWED_METHODS = "GET, POST, PATCH, OPTIONS";
const ALLOWED_HEADERS = `Content-Type, x-request-id, ${MOCK_AUTH_HEADER}`;
const CORS_MAX_AGE_SECONDS = "600";

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Vary": "Origin",
  };
}

function applyCors(response: Response, origin: string | null): Response {
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    response.headers.set(key, value);
  }
  return response;
}

const simulateAnniversarySchema = z
  .object({ employeeId: z.string().min(1) })
  .strict();

function jsonOk(data: unknown): Response {
  return NextResponse.json(data);
}

function jsonError(error: unknown, status: number): Response {
  return NextResponse.json(error, { status });
}

function badRequest(message: string): Response {
  return jsonError(
    createHCMError({ code: HCM_ERROR_CODE.UNKNOWN, message, retryable: false }),
    400,
  );
}

function toResponse(error: unknown): Response {
  if (isStoreRouteError(error)) {
    return jsonError(error.hcmError, error.status);
  }

  return jsonError(
    createHCMError({
      code: HCM_ERROR_CODE.UNKNOWN,
      message: "Internal server error",
      retryable: false,
    }),
    500,
  );
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Single entry for Next.js routes and MSW. Handles CORS preflight, then auth,
 * rate limiting, and routing — and stamps CORS headers on every response.
 */
export async function handleHcmRequest(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(origin),
        "Access-Control-Max-Age": CORS_MAX_AGE_SECONDS,
      },
    });
  }

  return applyCors(await routeHcmRequest(request), origin);
}

async function routeHcmRequest(request: Request): Promise<Response> {
  if (request.headers.get(MOCK_AUTH_HEADER) !== MOCK_AUTH_VALUE) {
    return jsonError(
      createHCMError({
        code: HCM_ERROR_CODE.UNKNOWN,
        message: "Unauthorized",
        retryable: false,
      }),
      401,
    );
  }

  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(HCM_PREFIX)) {
    return badRequest("Not an HCM path");
  }

  const subPath = pathname.slice(HCM_PREFIX.length);
  const method = request.method;

  try {
    if (method === "POST" || method === "PATCH") {
      enforceWriteRateLimit();
    }
    await applySlowDelayIfArmed();

    if (method === "GET" && subPath === "/balances/batch") {
      return jsonOk(getBatch());
    }

    if (method === "GET" && subPath === "/requests") {
      return jsonOk({ requests: listRequests() });
    }

    if (method === "GET" && subPath === "/approvals/pending") {
      return jsonOk(getPendingApprovals());
    }

    const cellGet = subPath.match(/^\/balances\/([^/]+)\/([^/]+)$/);
    if (method === "GET" && cellGet) {
      return jsonOk(getCell(cellGet[1], cellGet[2]));
    }

    const cellPost = subPath.match(/^\/balances\/([^/]+)\/([^/]+)$/);
    if (method === "POST" && cellPost) {
      const parsed = balanceWriteInputSchema.safeParse(await readBody(request));
      if (!parsed.success) {
        return badRequest("Invalid request body");
      }
      return jsonOk(writeCell(cellPost[1], cellPost[2], parsed.data));
    }

    if (method === "POST" && subPath === "/requests") {
      const parsed = submitTimeOffRequestInputSchema.safeParse(
        await readBody(request),
      );
      if (!parsed.success) {
        return badRequest("Invalid request body");
      }
      return jsonOk(createRequest(parsed.data));
    }

    const requestPatch = subPath.match(/^\/requests\/([^/]+)$/);
    if (method === "PATCH" && requestPatch) {
      const parsed = patchTimeOffRequestInputSchema.safeParse(
        await readBody(request),
      );
      if (!parsed.success) {
        return badRequest("Invalid request body");
      }
      return jsonOk(patchRequest(requestPatch[1], parsed.data));
    }

    if (method === "POST" && subPath === "/simulate/anniversary") {
      const parsed = simulateAnniversarySchema.safeParse(await readBody(request));
      if (!parsed.success) {
        return badRequest("Invalid request body");
      }
      return jsonOk(simulateAnniversary(parsed.data.employeeId));
    }

    if (method === "POST" && subPath === "/simulate/silent-fail") {
      armSilentFail();
      return jsonOk({ armed: true });
    }

    if (method === "POST" && subPath === "/simulate/conflict") {
      armConflict();
      return jsonOk({ armed: true });
    }

    if (method === "POST" && subPath === "/simulate/slow") {
      armSlow();
      return jsonOk({ armed: true });
    }

    // Test-only: reset the in-memory store to seed (used by E2E specs for isolation).
    if (method === "POST" && subPath === "/simulate/reset") {
      resetStore();
      return jsonOk({ reset: true });
    }

    return jsonError(
      createHCMError({
        code: HCM_ERROR_CODE.UNKNOWN,
        message: `No mock route for ${method} ${subPath}`,
        retryable: false,
      }),
      404,
    );
  } catch (error) {
    return toResponse(error);
  }
}
