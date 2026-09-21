# CLAUDE.md — GameShelf

Conventions for working in this repository. `PROJECT_PLAN.md` is the roadmap; `README.md` is how to run things.

## What this is

A personal game-collection tracker whose real purpose is to rehearse an Azure deployment pipeline
(managed identities, OIDC federation, slot swaps, private networking). It is a standalone project —
describe it on its own terms; do not compare it to or reference other projects in docs or code.

## Commands

The root `package.json` is the task runner — prefer its scripts over raw commands so behaviour matches the README and CI:

```powershell
npm run setup                    # once (dotnet tools + restore, npm ci) — only for the inner loop
npm run db:up                    # SQL Server container (waits for healthy)
npm run dev:api / npm run dev:web
npm test                         # every suite, in containers (docker-compose.test.yml)
npm run test:backend / test:frontend / test:e2e
npm run lint / npm run build / npm run bicep:build
npm run ci:local                 # lint + npm test + bicep:build — what CI runs
```

`dotnet run --project src/GameShelf.Api` uses the `http` launch profile (port 8080, Development).

## Tests run in containers only (`docker-compose.test.yml`)

- **There is one way to run tests**: the container stack, locally and in CI. Do not add host-side `dotnet test` / `vitest` / `playwright` scripts to the root `package.json` or host-toolchain jobs to `ci.yml`. (Running `dotnet test` or `npx vitest` by hand while iterating is fine; it just is not a supported path.)
- Driven only through `scripts/docker-test.mjs` (`up --build --abort-on-container-exit --exit-code-from <runner>`, then `down --volumes`). Keep that script shell-agnostic — no `&&`-chains or env prefixes in root `package.json`.
- `frontend-tests` runs `npm run check` (lint + format check + typecheck + generated-types check + Vitest) from `src/gameshelf-web/Dockerfile.test`, whose build context is the repo root so it can read `infra/openapi.json`; `playwright.config.ts` starts no servers and requires `E2E_BASE_URL`.
- Every service in a profile is long-running or is the runner. Never add a one-shot helper (seed, init) as a separate service: it exits 0 and aborts the stack. Fold such work into the runner's entrypoint.
- The `sqlserver` healthcheck runs `CREATE DATABASE` (via a marker DB), not `SELECT 1`, because DDL fails for a while after `SELECT 1` starts succeeding on SQL Server 2022. Keep it that way.
- Runner images COPY sources from the repo-root context (`tests/Dockerfile`) — never bind-mount `src/` or `tests/` into them, host `bin/obj` would break the build.
- `Dockerfile.e2e`'s base image tag must equal the exact `@playwright/test` version in `src/gameshelf-web/package.json` (pinned, no caret). Bump both together.
- The e2e container's entrypoint waits for `API_READY_URL` and `E2E_BASE_URL` before running Playwright.

## Backend conventions

- Single Web API project. `Controllers/` → `Data/IGameRepository` → EF Core. Keep controllers thin; mapping lives in `Models/GameDto.From`.
- Every async method takes a `CancellationToken` and passes it down.
- Errors are RFC 7807 problem details (`AddProblemDetails`, `[ApiController]` validation, `GlobalExceptionHandler` for anything unhandled). Every problem response carries a `correlationId`; the exception message is only included in Development. Never add `[Produces("application/json")]` to a controller — it overrides `application/problem+json` on 400s.
- `/health/ready` must do a real database round-trip (`SqlReadinessProbe`). It gates deployment-slot swaps; a stubbed version would defeat the point.
- Logging is Serilog, compact JSON to stdout, configured in the `Serilog` section of appsettings (there is no `Logging` section). `CorrelationIdMiddleware` honours an inbound `X-Correlation-Id`, echoes it on the response and puts it on every log line; CORS exposes that header. Log with message templates (`{Name}`), never string interpolation.
- Telemetry is opt-in: Azure Monitor OpenTelemetry and the Application Insights sink are wired only when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set (Bicep sets it). Local runs and every test stack stay silent — keep it that way.
- Every response gets the security headers set in `Program.cs` (`default-src 'none'` CSP, relaxed only for `/swagger`).
- Do not enable `InvariantGlobalization` — `Microsoft.Data.SqlClient` throws at connect time.
- Migrations: `dotnet ef migrations add <Name> --project src/GameShelf.Api --output-dir Data/Migrations`. Startup applies them only when `Database:MigrateOnStartup=true` (local dev). Cloud applies them in the deploy workflow.
- Configuration keys: `ConnectionStrings:GameShelf`, `Cors:AllowedOrigins`, `Database:MigrateOnStartup`, `Auth:Enabled`, `Auth:Issuer`, `Auth:Audience`, `Auth:BootstrapCurators`. Environment-variable form uses `__` (e.g. `ConnectionStrings__GameShelf`).

## Auth conventions

- Tokens prove *who*; the `Users` table decides *what*. `RoleClaimsTransformation` adds a `gameshelf:role` claim from `IUserRoleResolver` (database lookup by `sub`). Never read a role from a token claim; never grant access to a subject that has no row.
- Policies: `AuthPolicies.Reader` (Reader or Curator) on the controller, `AuthPolicies.Curator` on writes. The fallback policy requires authentication, so a new controller is protected by default; only health endpoints carry `[AllowAnonymous]`.
- `Auth:Enabled=false` = local mode: `DisabledAuthenticationHandler` signs everybody in as `local-dev`/Curator. It is the default in Development and in every test stack, and it throws at startup in Production. Contract tests use their own `TestAuthHandler` (`X-Test-Subject` header) with `FakeRoleResolver` so they can exercise 401/403 without a token.
- `Auth:BootstrapCurators` lists subjects/emails that get a Curator row on first sign-in. It is how the first account gets in; everything after that is data.
- Issuer and client id are public identifiers, not secrets, but they are per-org: local values live in `dotnet user-secrets` / `src/gameshelf-web/.env.local` / `.env`, cloud values in GitHub Environment *variables* and Bicep parameters. Nothing auth-related is committed.
- SPA: `@okta/okta-react` over `@okta/okta-auth-js`. `main.tsx` creates one `OktaAuth` (or none → local mode) outside React and points `setAccessTokenProvider` (`src/api/token.ts`) at it, so `src/api/` stays framework-free and nothing depends on render order or StrictMode's double mount. `AuthProvider` wraps the tree in `<Security>` and translates okta-react's state into the app's own `AuthSession` context (`src/auth/session.ts`); components only ever call `useAuth()` and never import the SDK. `/login/callback` is a real route rendering `<LoginCallback>`, registered only when an identity provider is configured. Never request the `groups` scope.
- The SPA decides what to render from `GET /api/me` (`useCurrentUser`), never from the token. Readers see the collection without the form or the actions column (`GameList canEdit`).

## Test taxonomy (backend)

| Project | Rule |
|---|---|
| `GameShelf.Api.Tests/Unit` | xUnit + FluentAssertions + NSubstitute. No host, no HTTP. |
| `GameShelf.Api.Tests/ContractTests` | `ContractApiFactory` boots the real pipeline with `IGameRepository` and `IReadinessProbe` substituted and an unroutable connection string. Assert routes, status codes and JSON shape only. Touching the database here is a bug. |
| `GameShelf.Api.IntegrationTests` | `IntegrationApiFactory` against a real SQL Server (`GAMESHELF_TEST_CONNECTION_STRING`, default: local container, database `gameshelf_test`). Collections run serially. Each test class resets the table in `InitializeAsync`. |

New endpoint → add a contract test for its shape and an integration test for its persistence.

## Frontend conventions

- `src/api/` is framework-free (`fetch` only; the API base URL comes from `src/config.ts`: runtime `window.__GAMESHELF_CONFIG__` → `VITE_API_BASE_URL` → same-origin).
- `src/hooks/` own server state through TanStack Query (`useQuery` / `useMutation`, writes invalidate rather than patch the cache) and call `src/api/`; components are presentational and take callbacks. No `useEffect` + `fetch`.
- Routing is React Router (`App.tsx` holds the routes, screens live in `src/pages/`).
- `src/types/game.ts` and `user.ts` are aliases over `src/types/generated/api.ts`. Never hand-write an API shape and never edit the generated file.
- Import via `@/…`, never deep relative paths.
- Every interactive element has a `data-testid`; Playwright selects by test id.
- Unit tests are colocated (`X.test.tsx`) and use MSW (`src/test/handlers.ts`). `onUnhandledRequest: 'error'` — never mock `fetch` directly.
- Render `App` through `renderApp()` from `src/test/auth.tsx` (router + a fresh no-retry `QueryClient`; defaults to local mode); use `FakeAuthClient` + `setCurrentUser()` for signed-out / no-access / Reader / Curator states. It feeds `AuthSessionContext`, the seam the app owns — never plant tokens in storage under the SDK's keys.
- Formatting is Prettier (`.prettierrc.json`); `npm run check` fails on unformatted files and the husky pre-commit hook (lint-staged) formats and lints staged SPA files.
- E2E specs create data with a unique title per run and delete what they create.
- Production image: nginx; `docker-entrypoint.sh` writes `runtime-config.js` (values JSON-escaped) from `API_BASE_URL`, `OKTA_ISSUER`, `OKTA_CLIENT_ID`, and writes the security headers nginx includes in every location. The CSP is built there because `connect-src` must name the API and issuer origins and `frame-src` the issuer (token renewal runs in a hidden iframe) — all only known at runtime. Never bake environment URLs into the build. The image build compiles `tsconfig.build.json` (app without tests); `npm run typecheck` covers everything.

## The API contract spine

Component tests run against mocks, so three checks keep the mocks honest. All of them run inside the normal test containers:

| Link | Enforced by |
|---|---|
| Running API ↔ `infra/openapi.json` (committed) | `OpenApiContractTests` in the backend contract suite |
| `infra/openapi.json` ↔ `src/types/generated/api.ts` (committed) | `npm run generate:types:check` inside `npm run check` |
| `infra/openapi.json` ↔ MSW handlers | `src/test/openapi-coverage.test.ts`: every `/api` operation has a handler and no handler is orphaned |

After changing a controller or DTO run `npm run contract:update` (needs the host .NET SDK), then add or adjust the MSW handler, and commit all of it together. Swagger is configured so the document tells the truth: non-nullable members are `required`, and `UseAllOfToExtendReferenceSchemas` lets a nullable enum reference (`role` on `/api/me`) stay nullable.

## Infrastructure conventions

- `infra/bicep/main.bicep` is the only entry point; modules take `location`, `tags`, and explicit names. Names are computed once in `main.bicep`.
- Role assignments are **not** in Bicep (`infra/scripts/bootstrap.ps1` does them) so a Contributor-only pipeline identity can re-run the template.
- SQL is Entra-only; the admin is set by `principalId`. The runtime connection string uses the runtime identity's `clientId` as `User Id`.
- Phase 6 modules (`network.bicep`, `privateEndpoint.bicep`) exist but are not referenced until that phase.
- `deploy.yml` is `workflow_dispatch` only and has no secrets — cloud auth is OIDC via the `dev` GitHub Environment's variables. The same variables carry `OKTA_ISSUER`, `OKTA_CLIENT_ID`, `BOOTSTRAP_CURATOR` into Bicep; the API app always runs with `Auth__Enabled=true`.

## Cost rule

The Azure credit expires 2026-09-21. Any session that creates cloud resources ends with `./infra/scripts/teardown.ps1`.

## Phase status

Phase 0 tooling ✅ · Phase 1 ✅ · Phase 2 ✅ (code; real sign-in verified by hand) · Phase 2.5 ✅ · Phases 3-7 see `PROJECT_PLAN.md`.
