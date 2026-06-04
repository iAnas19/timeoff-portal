import { handleHcmRequest } from "@/mocks/router";

export async function GET(request: Request) {
  return handleHcmRequest(request);
}

export async function POST(request: Request) {
  return handleHcmRequest(request);
}

export async function PATCH(request: Request) {
  return handleHcmRequest(request);
}

export async function OPTIONS(request: Request) {
  return handleHcmRequest(request);
}
