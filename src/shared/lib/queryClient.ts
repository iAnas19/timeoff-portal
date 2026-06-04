import { QueryClient } from "@tanstack/react-query";
import { isHCMError } from "@/shared/api/errors";
import { MAX_HCM_RETRIES } from "@/shared/hcm/constants";

const DEFAULT_STALE_TIME_MS = 0;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        retry: (failureCount, error) => {
          if (isHCMError(error)) {
            return error.retryable && failureCount < MAX_HCM_RETRIES;
          }
          return false;
        },
      },
      mutations: {
        // Never auto-retry mutations. Writes here are non-idempotent — a POST/PATCH
        // that times out may have *already succeeded* on the server, so retrying
        // duplicates it (observed: one slow submit creating two manager entries).
        // A failed write surfaces to the user (rolled-back, with the reason); a
        // manual retry is safe because they can see the reconciled result first.
        retry: false,
      },
    },
  });
}
