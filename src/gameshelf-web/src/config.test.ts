import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiBaseUrl, getAuthConfig } from '@/config';

const original = window.__GAMESHELF_CONFIG__;

afterEach(() => {
  window.__GAMESHELF_CONFIG__ = original;
  vi.unstubAllEnvs();
});

describe('getApiBaseUrl', () => {
  it('prefers the runtime config over the build-time env', () => {
    window.__GAMESHELF_CONFIG__ = { apiBaseUrl: 'https://runtime.example' };
    vi.stubEnv('VITE_API_BASE_URL', 'https://build.example');

    expect(getApiBaseUrl()).toBe('https://runtime.example');
  });

  it('falls back to the build-time env when runtime config is empty', () => {
    window.__GAMESHELF_CONFIG__ = {};
    vi.stubEnv('VITE_API_BASE_URL', 'https://build.example');

    expect(getApiBaseUrl()).toBe('https://build.example');
  });

  it('falls back to same-origin when nothing is configured', () => {
    window.__GAMESHELF_CONFIG__ = undefined;
    vi.stubEnv('VITE_API_BASE_URL', '');

    expect(getApiBaseUrl()).toBe('');
  });

  it('strips trailing slashes', () => {
    window.__GAMESHELF_CONFIG__ = { apiBaseUrl: 'https://runtime.example///' };

    expect(getApiBaseUrl()).toBe('https://runtime.example');
  });
});

describe('getAuthConfig', () => {
  it('is null when no identity provider is configured (local mode)', () => {
    window.__GAMESHELF_CONFIG__ = { apiBaseUrl: 'https://runtime.example', oktaIssuer: '', oktaClientId: '' };
    vi.stubEnv('VITE_OKTA_ISSUER', '');
    vi.stubEnv('VITE_OKTA_CLIENT_ID', '');

    expect(getAuthConfig()).toBeNull();
  });

  it('is null when only half of the settings are present', () => {
    window.__GAMESHELF_CONFIG__ = { oktaIssuer: 'https://idp.example/oauth2/default' };
    vi.stubEnv('VITE_OKTA_CLIENT_ID', '');

    expect(getAuthConfig()).toBeNull();
  });

  it('prefers the runtime config over the build-time env', () => {
    window.__GAMESHELF_CONFIG__ = {
      oktaIssuer: 'https://runtime.example/oauth2/default/',
      oktaClientId: 'runtime-client',
    };
    vi.stubEnv('VITE_OKTA_ISSUER', 'https://build.example/oauth2/default');
    vi.stubEnv('VITE_OKTA_CLIENT_ID', 'build-client');

    expect(getAuthConfig()).toEqual({ issuer: 'https://runtime.example/oauth2/default', clientId: 'runtime-client' });
  });

  it('falls back to the build-time env', () => {
    window.__GAMESHELF_CONFIG__ = {};
    vi.stubEnv('VITE_OKTA_ISSUER', 'https://build.example/oauth2/default');
    vi.stubEnv('VITE_OKTA_CLIENT_ID', 'build-client');

    expect(getAuthConfig()).toEqual({ issuer: 'https://build.example/oauth2/default', clientId: 'build-client' });
  });
});
