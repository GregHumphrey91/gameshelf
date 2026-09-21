import { createContext, useContext } from 'react';

/**
 * What the rest of the app knows about the sign-in session. Components read this (through useAuth)
 * and never import the identity-provider SDK, so they render the same in local mode, under a real
 * provider, and in tests that supply a session directly.
 */
export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

export interface AuthSession {
  /** False when no identity provider is configured (local mode): nobody signs in and no tokens are sent. */
  enabled: boolean;
  status: AuthStatus;
  email: string | null;
  name: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** Local mode: always signed in as nobody in particular; the API decides what that means. */
export const LOCAL_SESSION: AuthSession = {
  enabled: false,
  status: 'signed-in',
  email: null,
  name: null,
  signIn: async () => {},
  signOut: async () => {},
};

export const AuthSessionContext = createContext<AuthSession | null>(null);

export function useAuthSession(): AuthSession {
  const session = useContext(AuthSessionContext);
  if (!session) throw new Error('useAuth must be used inside <AuthProvider>');
  return session;
}
