import type { AuthState } from '@okta/okta-auth-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOktaAuthClient, LOGIN_CALLBACK_PATH, oktaOptions, toSession, type OktaLike } from '@/auth/oktaAuthClient';

const config = { issuer: 'https://idp.example/oauth2/default', clientId: 'client-123' };

/** The parts of the SDK the client touches, as spies. `emit` simulates an auth-state change. */
function fakeOkta() {
  let handler: ((state: AuthState) => void) | undefined;
  const okta = {
    isLoginRedirect: vi.fn(() => false),
    handleLoginRedirect: vi.fn(async () => {}),
    start: vi.fn(async () => {}),
    getOrRenewAccessToken: vi.fn(async (): Promise<string | null> => null),
    signInWithRedirect: vi.fn(async () => {}),
    signOut: vi.fn(async () => true),
    authStateManager: {
      subscribe: vi.fn((h: (state: AuthState) => void) => {
        handler = h;
      }),
    },
  };
  return { okta: okta as unknown as OktaLike, spies: okta, emit: (state: AuthState) => handler?.(state) };
}

const signedIn: AuthState = {
  isAuthenticated: true,
  idToken: { claims: { sub: '00u1', email: 'player@example.com', name: 'Player One' } } as AuthState['idToken'],
};

describe('oktaOptions', () => {
  it('uses PKCE, the callback path on the current origin and the id/email scopes', () => {
    const options = oktaOptions(config, 'https://app.example');

    expect(options).toMatchObject({
      issuer: config.issuer,
      clientId: config.clientId,
      pkce: true,
      redirectUri: `https://app.example${LOGIN_CALLBACK_PATH}`,
      scopes: ['openid', 'profile', 'email'],
    });
    expect(options).not.toHaveProperty('clientSecret');
  });

  it('restores the original location without reloading', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    const options = oktaOptions(config, 'https://app.example');

    await options.restoreOriginalUri!(undefined as never, 'https://app.example/shelf?tab=1');
    await options.restoreOriginalUri!(undefined as never, undefined);

    expect(replaceState).toHaveBeenNthCalledWith(1, null, '', '/shelf?tab=1');
    expect(replaceState).toHaveBeenNthCalledWith(2, null, '', '/');
  });
});

describe('toSession', () => {
  it('maps SDK state to the session view', () => {
    expect(toSession(null)).toEqual({ status: 'loading', email: null, name: null });
    expect(toSession({ isAuthenticated: false })).toEqual({ status: 'signed-out', email: null, name: null });
    expect(toSession(signedIn)).toEqual({ status: 'signed-in', email: 'player@example.com', name: 'Player One' });
  });
});

describe('createOktaAuthClient', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts loading and publishes session changes to subscribers', () => {
    const { okta, emit } = fakeOkta();
    const client = createOktaAuthClient(config, okta);
    const seen: string[] = [];
    const unsubscribe = client.subscribe((s) => seen.push(s.status));

    expect(client.enabled).toBe(true);
    expect(client.getSession().status).toBe('loading');

    emit({ isAuthenticated: false });
    emit(signedIn);
    unsubscribe();
    emit({ isAuthenticated: false });

    expect(seen).toEqual(['signed-out', 'signed-in']);
    expect(client.getSession()).toEqual({ status: 'signed-out', email: null, name: null });
  });

  it('starts the SDK without touching the callback when not on a login redirect', async () => {
    const { okta, spies } = fakeOkta();

    await createOktaAuthClient(config, okta).start();

    expect(spies.handleLoginRedirect).not.toHaveBeenCalled();
    expect(spies.start).toHaveBeenCalledTimes(1);
  });

  it('completes the login redirect before starting', async () => {
    const { okta, spies } = fakeOkta();
    spies.isLoginRedirect.mockReturnValue(true);
    const order: string[] = [];
    spies.handleLoginRedirect.mockImplementation(async () => {
      order.push('callback');
    });
    spies.start.mockImplementation(async () => {
      order.push('start');
    });

    await createOktaAuthClient(config, okta).start();

    expect(order).toEqual(['callback', 'start']);
  });

  it('still starts when the callback cannot be completed', async () => {
    const { okta, spies } = fakeOkta();
    spies.isLoginRedirect.mockReturnValue(true);
    spies.handleLoginRedirect.mockRejectedValue(new Error('state mismatch'));

    await expect(createOktaAuthClient(config, okta).start()).resolves.toBeUndefined();

    expect(spies.start).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });

  it('hands out the current access token, or null', async () => {
    const { okta, spies } = fakeOkta();
    const client = createOktaAuthClient(config, okta);

    await expect(client.getAccessToken()).resolves.toBeNull();

    spies.getOrRenewAccessToken.mockResolvedValue('token-1');
    await expect(client.getAccessToken()).resolves.toBe('token-1');
  });

  it('signs in with a redirect back to the current page', async () => {
    const { okta, spies } = fakeOkta();
    window.history.pushState(null, '', '/shelf?sort=title');

    await createOktaAuthClient(config, okta).signIn();

    expect(spies.signInWithRedirect).toHaveBeenCalledWith({ originalUri: '/shelf?sort=title' });
    window.history.pushState(null, '', '/');
  });

  it('signs out back to the app origin', async () => {
    const { okta, spies } = fakeOkta();

    await createOktaAuthClient(config, okta).signOut();

    expect(spies.signOut).toHaveBeenCalledWith({ postLogoutRedirectUri: window.location.origin });
  });
});
