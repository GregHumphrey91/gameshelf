import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { TEST_API_BASE } from '@/test/api';
import { setAccessTokenProvider } from '@/api/token';
import { resetCurrentUser, resetGames } from '@/test/handlers';
import { server } from '@/test/server';

// Every API call in unit tests goes through MSW. An unhandled request is a test bug, not a warning.
beforeAll(() => {
  window.__GAMESHELF_CONFIG__ = { apiBaseUrl: TEST_API_BASE };
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetGames();
  resetCurrentUser();
  setAccessTokenProvider(async () => null);
});

afterAll(() => server.close());
