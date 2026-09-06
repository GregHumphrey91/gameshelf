import { render } from '@testing-library/react';
import { vi } from 'vitest';
import App from '@/App';
import { AuthProvider } from '@/auth/AuthContext';
import { createDisabledAuthClient, type AuthClient, type AuthSession } from '@/auth/authClient';

export const SIGNED_OUT: AuthSession = { status: 'signed-out', email: null, name: null };
export const SIGNED_IN: AuthSession = { status: 'signed-in', email: 'player@example.com', name: 'Player One' };

/** A controllable identity-provider stand-in for component tests. */
export class FakeAuthClient implements AuthClient {
  readonly enabled = true;
  started = false;
  token: string | null = 'fake-access-token';
  readonly signIn = vi.fn(async () => {});
  readonly signOut = vi.fn(async () => {});

  private session: AuthSession;
  private readonly listeners = new Set<(session: AuthSession) => void>();

  constructor(session: AuthSession = SIGNED_IN) {
    this.session = session;
  }

  setSession(session: AuthSession) {
    this.session = session;
    this.listeners.forEach((listener) => listener(session));
  }

  start = async () => {
    this.started = true;
  };

  getSession = () => this.session;

  subscribe = (listener: (session: AuthSession) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getAccessToken = async () => this.token;
}

/** Renders the app inside an AuthProvider. Defaults to local mode (no identity provider). */
export function renderApp(client: AuthClient = createDisabledAuthClient()) {
  return render(
    <AuthProvider client={client}>
      <App />
    </AuthProvider>,
  );
}
