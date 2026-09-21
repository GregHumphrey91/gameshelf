import { describe, expect, it } from 'vitest';
import spec from '../../../../infra/openapi.json';
import { TEST_API_BASE } from '@/test/api';
import { handlers } from '@/test/handlers';

/**
 * Component tests run against MSW rather than a live API, which is fast and deterministic and
 * carries one real risk: the mocks drift, and the suite ends up proving the frontend works
 * beautifully against an API that no longer exists.
 *
 * This is what stops that. Every /api operation in the committed OpenAPI document must have a
 * handler, and no handler may mock an operation the document does not list. The document itself
 * is checked against the running API by the backend suite (OpenApiContractTests), so the chain
 * from controller to component test has no unverified link in it.
 */
describe('MSW handler coverage', () => {
  // The health probes are for the platform, not the SPA; nothing in the browser ever calls them.
  const isCalledByTheSpa = (path: string) => path.startsWith('/api/');

  // "/api/games/{id}" in OpenAPI is "/api/games/:id" to MSW.
  const toMswPath = (path: string) => path.replace(/\{(\w+)\}/g, ':$1');

  const specOperations = Object.entries(spec.paths)
    .filter(([path]) => isCalledByTheSpa(path))
    .flatMap(([path, operations]) =>
      Object.keys(operations).map((method) => ({ method: method.toUpperCase(), path: toMswPath(path) })),
    );

  const handled = handlers.map((handler) => ({
    method: String(handler.info.method),
    path: String(handler.info.path).replace(TEST_API_BASE, ''),
  }));

  it('finds operations to check', () => {
    expect(specOperations.length).toBeGreaterThan(0);
    expect(handled.length).toBeGreaterThan(0);
  });

  it.each(specOperations)('has a handler for $method $path', ({ method, path }) => {
    const match = handled.find((h) => h.method === method && h.path === path);

    expect(match, `No MSW handler for ${method} ${path}. Add one in src/test/handlers.ts.`).toBeDefined();
  });

  it('has no handler for an operation the API does not expose', () => {
    const known = new Set(specOperations.map((o) => `${o.method} ${o.path}`));
    const orphans = handled.map((h) => `${h.method} ${h.path}`).filter((key) => !known.has(key));

    expect(orphans, 'These handlers mock operations that no longer exist').toEqual([]);
  });
});
