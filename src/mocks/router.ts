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
  getBatch,
  getCell,
  isStoreRouteError,
  patchRequest,
  simulateAnniversary,
  writeCell,
} from "@/mocks/store";

export const MOCK_AUTH_HEADER = "x-mock-auth";
export const MOCK_AUTH_VALUE = "demo";

export const MOCK_AUTH_HEADERS = {
  [MOCK_AUTH_HEADER]: MOCK_AUTH_VALUE,
};

const HCM_PREFIX = "/api/hcm";

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

/** Single entry for Next.js routes and MSW — matches path + method, calls store. */
export async function handleHcmRequest(request: Request): Promise<Response> {
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
    await applySlowDelayIfArmed();

    if (method === "GET" && subPath === "/balances/batch") {
      return jsonOk(getBatch());
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
