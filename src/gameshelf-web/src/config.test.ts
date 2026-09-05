import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiBaseUrl } from '@/config';

describe('getApiBaseUrl', () => {
  const original = window.__GAMESHELF_CONFIG__;

  afterEach(() => {
    window.__GAMESHELF_CONFIG__ = original;
    vi.unstubAllEnvs();
  });

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
