import { http } from "msw";
import { handleHcmRequest } from "@/mocks/router";

export { MOCK_AUTH_HEADERS } from "@/shared/constants/mockAuth";

export const hcmHandlers = [
  http.get("*/api/hcm/*", ({ request }) => handleHcmRequest(request)),
  http.post("*/api/hcm/*", ({ request }) => handleHcmRequest(request)),
  http.patch("*/api/hcm/*", ({ request }) => handleHcmRequest(request)),
];
