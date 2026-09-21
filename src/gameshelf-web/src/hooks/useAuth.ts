import { useAuthSession, type AuthSession } from '@/auth/session';

export type UseAuthResult = AuthSession;

export function useAuth(): UseAuthResult {
  return useAuthSession();
}
