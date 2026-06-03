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
        retry: (failureCount, error) => {
          if (isHCMError(error)) {
            return error.retryable && failureCount < MAX_HCM_RETRIES;
          }
          return false;
        },
      },
    },
  });
}
