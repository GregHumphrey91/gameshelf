import { useQuery } from '@tanstack/react-query';
import { meApi } from '@/api/me';
import type { CurrentUser } from '@/types/user';

export interface UseCurrentUserResult {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
}

export const currentUserKey = ['me'] as const;

/** Asks the API who the caller is. Only runs once there is a signed-in session (`enabled`). */
export function useCurrentUser(enabled: boolean): UseCurrentUserResult {
  const query = useQuery({ queryKey: currentUserKey, queryFn: meApi.get, enabled });

  return {
    user: enabled ? (query.data ?? null) : null,
    loading: enabled && query.isPending,
    error: query.error ? query.error.message : null,
  };
}
