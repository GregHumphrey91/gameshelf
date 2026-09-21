import { useSyncExternalStore, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '@/App';
import { AuthSessionContext, LOCAL_SESSION, type AuthSession, type AuthStatus } from '@/auth/session';

export interface SessionState {
  status: AuthStatus;
  email: string | null;
  name: string | null;
}

export const SIGNED_OUT: SessionState = { status: 'signed-out', email: null, name: null };
export const SIGNED_IN: SessionState = { status: 'signed-in', email: 'player@example.com', name: 'Player One' };

/**
 * A controllable identity-provider stand-in for component tests. It feeds AuthSessionContext — the
 * seam the app itself owns — so no test depends on how the provider SDK stores its state.
 */
export class FakeAuthClient {
  readonly signIn = vi.fn(async () => {});
  readonly signOut = vi.fn(async () => {});

  private session: AuthSession;
  private readonly listeners = new Set<() => void>();

  constructor(state: SessionState = SIGNED_IN) {
    this.session = this.toSession(state);
  }

  setSession(state: SessionState) {
    this.session = this.toSession(state);
    this.listeners.forEach((listener) => listener());
  }

  getSession = () => this.session;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private toSession(state: SessionState): AuthSession {
    return { enabled: true, ...state, signIn: this.signIn, signOut: this.signOut };
  }
}

function FakeAuthProvider({ client, children }: { client: FakeAuthClient | null; children: ReactNode }) {
  const session = useSyncExternalStore(
    client?.subscribe ?? noSubscription,
    client?.getSession ?? getLocalSession,
    client?.getSession ?? getLocalSession,
  );
  return <AuthSessionContext.Provider value={session}>{children}</AuthSessionContext.Provider>;
}

const noSubscription = () => () => {};
const getLocalSession = () => LOCAL_SESSION;

/** A fresh cache per render, and no retries: a test that expects an error should see it immediately. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

/** Renders the whole app. Defaults to local mode (no identity provider). */
export function renderApp(client: FakeAuthClient | null = null, { route = '/' }: { route?: string } = {}) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        <FakeAuthProvider client={client}>
          <App />
        </FakeAuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
