import { setupServer } from "msw/node";
import { hcmHandlers } from "@/mocks/mswHandlers";

export const hcmServer = setupServer(...hcmHandlers);
