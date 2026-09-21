import type { AuthState } from '@okta/okta-auth-js';
import { describe, expect, it } from 'vitest';
import { LOGIN_CALLBACK_PATH, oktaOptions, toSessionState } from '@/auth/oktaAuth';

const config = { issuer: 'https://idp.test/oauth2/default', clientId: 'spa-client' };

describe('oktaOptions', () => {
  it('uses authorization code + PKCE and the callback route on the current origin', () => {
    const options = oktaOptions(config, 'https://shelf.test');

    expect(options.pkce).toBe(true);
    expect(options.issuer).toBe(config.issuer);
    expect(options.clientId).toBe(config.clientId);
    expect(options.redirectUri).toBe(`https://shelf.test${LOGIN_CALLBACK_PATH}`);
  });

  it('never asks for groups: roles come from the API, not the token', () => {
    expect(oktaOptions(config, 'https://shelf.test').scopes).toEqual(['openid', 'profile', 'email']);
  });
});

describe('toSessionState', () => {
  it('is loading until the SDK has worked out the state', () => {
    expect(toSessionState(null).status).toBe('loading');
  });

  it('is signed out when unauthenticated', () => {
    expect(toSessionState({ isAuthenticated: false } as AuthState)).toEqual({
      status: 'signed-out',
      email: null,
      name: null,
    });
  });

  it('takes the display identity from the ID token', () => {
    const state = {
      isAuthenticated: true,
      idToken: { claims: { sub: '00u1', email: 'player@example.com', name: 'Player One' } },
    } as unknown as AuthState;

    expect(toSessionState(state)).toEqual({ status: 'signed-in', email: 'player@example.com', name: 'Player One' });
  });

  it('tolerates an ID token without profile claims', () => {
    const state = { isAuthenticated: true, idToken: { claims: { sub: '00u1' } } } as unknown as AuthState;

    expect(toSessionState(state)).toEqual({ status: 'signed-in', email: null, name: null });
  });
});
