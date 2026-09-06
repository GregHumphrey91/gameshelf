import { useSyncExternalStore } from 'react';
import { useAuthClient } from '@/auth/AuthContext';
import type { AuthSession } from '@/auth/authClient';

export interface UseAuthResult extends AuthSession {
  enabled: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const client = useAuthClient();
  const session = useSyncExternalStore(client.subscribe, client.getSession, client.getSession);
  return { enabled: client.enabled, ...session, signIn: client.signIn, signOut: client.signOut };
}
