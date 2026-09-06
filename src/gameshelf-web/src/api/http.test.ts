import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { request } from '@/api/http';
import { meApi } from '@/api/me';
import { setAccessTokenProvider } from '@/api/token';
import { TEST_API_BASE } from '@/test/api';
import { server } from '@/test/server';

function captureAuthorization() {
  const seen: (string | null)[] = [];
  server.use(
    http.get(`${TEST_API_BASE}/api/echo`, ({ request }) => {
      seen.push(request.headers.get('authorization'));
      return HttpResponse.json({ ok: true });
    }),
  );
  return seen;
}

describe('request', () => {
  it('sends no Authorization header when there is no token (local mode)', async () => {
    const seen = captureAuthorization();

    await request('/api/echo');

    expect(seen).toEqual([null]);
  });

  it('sends the access token as a bearer token', async () => {
    const seen = captureAuthorization();
    setAccessTokenProvider(async () => 'abc.def.ghi');

    await request('/api/echo');

    expect(seen).toEqual(['Bearer abc.def.ghi']);
  });

  it('describes 401 and 403 in plain words when the body is empty', async () => {
    server.use(
      http.get(`${TEST_API_BASE}/api/denied`, () => new HttpResponse(null, { status: 403 })),
      http.get(`${TEST_API_BASE}/api/anonymous`, () => new HttpResponse(null, { status: 401 })),
    );

    await expect(request('/api/denied')).rejects.toMatchObject({ status: 403, message: 'Your account is not allowed to do that.' });
    await expect(request('/api/anonymous')).rejects.toMatchObject({ status: 401, message: 'You need to sign in to do that.' });
  });
});

describe('meApi', () => {
  it('returns the current user', async () => {
    await expect(meApi.get()).resolves.toEqual({ subject: 'local-dev', email: 'local-dev@gameshelf.local', role: 'Curator' });
  });
});
