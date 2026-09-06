/**
 * Framework-free view of the sign-in session. React only ever talks to this interface (via
 * AuthProvider / useAuth), and the API layer only asks it for an access token, so the identity
 * provider SDK stays confined to oktaAuthClient.ts.
 */
export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

export interface AuthSession {
  status: AuthStatus;
  email: string | null;
  name: string | null;
}

export interface AuthClient {
  /** False when no identity provider is configured (local mode): nobody signs in and no tokens are sent. */
  readonly enabled: boolean;
  /** Completes a login redirect if one is in progress, then starts tracking the session. Call once at boot. */
  start(): Promise<void>;
  getSession(): AuthSession;
  /** Returns an unsubscribe function. The listener is called with every session change. */
  subscribe(listener: (session: AuthSession) => void): () => void;
  /** A valid access token for the API, or null when there is none. */
  getAccessToken(): Promise<string | null>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

export const LOCAL_SESSION: AuthSession = { status: 'signed-in', email: null, name: null };

/** Local mode: always signed in as nobody in particular; the API decides what that means. */
export function createDisabledAuthClient(): AuthClient {
  return {
    enabled: false,
    start: async () => {},
    getSession: () => LOCAL_SESSION,
    subscribe: () => () => {},
    getAccessToken: async () => null,
    signIn: async () => {},
    signOut: async () => {},
  };
}
