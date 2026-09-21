import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/http';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The shelf is not a live feed; refetching on every window focus is noise.
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        // A 4xx is an answer, not an outage: retrying a 401 or 403 only delays telling the user.
        retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  });
}
