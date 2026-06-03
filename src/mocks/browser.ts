import { setupWorker } from "msw/browser";
import { hcmHandlers } from "@/mocks/mswHandlers";

export const hcmWorker = setupWorker(...hcmHandlers);
