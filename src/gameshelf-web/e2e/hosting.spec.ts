import { expect, test } from '@playwright/test';

// What the web container itself is responsible for. These only mean something against the real
// nginx image, which is what the e2e stack serves.
test.describe('web container', () => {
  test('sends the security headers, with a CSP that names the API origin', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

    // The API is on another origin in this stack; if connect-src did not name it, every call would be blocked.
    const runtimeConfig = await (await request.get('/runtime-config.js')).text();
    const apiBaseUrl = /apiBaseUrl: "([^"]*)"/.exec(runtimeConfig)?.[1] ?? '';
    const csp = headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    if (apiBaseUrl) expect(csp).toContain(new URL(apiBaseUrl).origin);
  });

  test('never lets the per-environment config be cached', async ({ request }) => {
    const response = await request.get('/runtime-config.js');

    expect(response.headers()['cache-control']).toContain('no-store');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('serves the app shell for client-side routes', async ({ request }) => {
    const response = await request.get('/login/callback');

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<div id="root">');
  });
});
