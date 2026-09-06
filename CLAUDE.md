# CLAUDE.md — GameShelf

Conventions for working in this repository. `PROJECT_PLAN.md` is the roadmap; `README.md` is how to run things.

## What this is

A personal game-collection tracker whose real purpose is to rehearse an Azure deployment pipeline
(managed identities, OIDC federation, slot swaps, private networking). It is a standalone project —
describe it on its own terms; do not compare it to or reference other projects in docs or code.

## Commands

The root `package.json` is the task runner — prefer its scripts over raw commands so behaviour matches the README and CI:

```powershell
npm run setup                    # once
npm run db:up                    # SQL Server container (waits for healthy)
npm run dev:api / npm run dev:web
npm run test:backend:unit        # no DB
npm run test:backend:integration # starts the DB
npm run test:frontend
npm run test:e2e                 # Playwright starts the API and Vite itself
npm test / npm run test:all
npm run test:docker[:backend|:frontend|:e2e]   # same suites inside containers (docker-compose.test.yml)
npm run lint / npm run build / npm run bicep:build
```

`dotnet run --project src/GameShelf.Api` uses the `http` launch profile (port 8080, Development). Playwright's `webServer` starts the API with `--no-launch-profile` and explicit env so it behaves the same in CI.

## Containerised test stack (`docker-compose.test.yml`)

- Driven only through `scripts/docker-test.mjs` (`up --build --abort-on-container-exit --exit-code-from <runner>`, then `down --volumes`). Keep that script shell-agnostic — no `&&`-chains or env prefixes in root `package.json`.
- Every service in a profile is long-running or is the runner. Never add a one-shot helper (seed, init) as a separate service: it exits 0 and aborts the stack. Fold such work into the runner's entrypoint.
- The `sqlserver` healthcheck runs `CREATE DATABASE` (via a marker DB), not `SELECT 1`, because DDL fails for a while after `SELECT 1` starts succeeding on SQL Server 2022. Keep it that way.
- Runner images COPY sources from the repo-root context (`tests/Dockerfile`) — never bind-mount `src/` or `tests/` into them, host `bin/obj` would break the build.
- `Dockerfile.e2e`'s base image tag must equal the exact `@playwright/test` version in `src/gameshelf-web/package.json` (pinned, no caret). Bump both together.
- Setting `E2E_BASE_URL` makes `playwright.config.ts` skip its `webServer` entries; the e2e container relies on this.

## Backend conventions

- Single Web API project. `Controllers/` → `Data/IGameRepository` → EF Core. Keep controllers thin; mapping lives in `Models/GameDto.From`.
- Every async method takes a `CancellationToken` and passes it down.
- Errors are RFC 7807 problem details (`AddProblemDetails`, `[ApiController]` validation). Never add `[Produces("application/json")]` to a controller — it overrides `application/problem+json` on 400s.
- `/health/ready` must do a real database round-trip (`SqlReadinessProbe`). It gates deployment-slot swaps; a stubbed version would defeat the point.
- Do not enable `InvariantGlobalization` — `Microsoft.Data.SqlClient` throws at connect time.
- Migrations: `dotnet ef migrations add <Name> --project src/GameShelf.Api --output-dir Data/Migrations`. Startup applies them only when `Database:MigrateOnStartup=true` (local dev). Cloud applies them in the deploy workflow.
- Configuration keys: `ConnectionStrings:GameShelf`, `Cors:AllowedOrigins`, `Database:MigrateOnStartup`, `Auth:Enabled`, `Auth:Issuer`, `Auth:Audience`, `Auth:BootstrapCurators`. Environment-variable form uses `__` (e.g. `ConnectionStrings__GameShelf`).

## Auth conventions

- Tokens prove *who*; the `Users` table decides *what*. `RoleClaimsTransformation` adds a `gameshelf:role` claim from `IUserRoleResolver` (database lookup by `sub`). Never read a role from a token claim; never grant access to a subject that has no row.
- Policies: `AuthPolicies.Reader` (Reader or Curator) on the controller, `AuthPolicies.Curator` on writes. The fallback policy requires authentication, so a new controller is protected by default; only health endpoints carry `[AllowAnonymous]`.
- `Auth:Enabled=false` = local mode: `DisabledAuthenticationHandler` signs everybody in as `local-dev`/Curator. It is the default in Development and in every test stack, and it throws at startup in Production. Contract tests use their own `TestAuthHandler` (`X-Test-Subject` header) with `FakeRoleResolver` so they can exercise 401/403 without a token.
- `Auth:BootstrapCurators` lists subjects/emails that get a Curator row on first sign-in. It is how the first account gets in; everything after that is data.
- Issuer and client id are public identifiers, not secrets, but they are per-org: local values live in `dotnet user-secrets` / `src/gameshelf-web/.env.local` / `.env`, cloud values in GitHub Environment *variables* and Bicep parameters. Nothing auth-related is committed.
- SPA: `src/auth/` wraps the identity-provider SDK behind the `AuthClient` interface; React only sees `AuthProvider` + `useAuth`. The API layer gets its token through `setAccessTokenProvider` (`src/api/token.ts`) so `src/api/` stays framework-free. No router: the callback path (`/login/callback`) is handled at boot by `authClient.start()`.
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
- `src/hooks/` own state and call `src/api/`; components are presentational and take callbacks.
- Import via `@/…`, never deep relative paths.
- Every interactive element has a `data-testid`; Playwright selects by test id.
- Unit tests are colocated (`X.test.tsx`) and use MSW (`src/test/handlers.ts`). `onUnhandledRequest: 'error'` — never mock `fetch` directly.
- Render `App` through `renderApp()` from `src/test/auth.tsx` (defaults to local mode); use `FakeAuthClient` + `setCurrentUser()` for signed-out / no-access / Reader / Curator states.
- E2E specs create data with a unique title per run and delete what they create.
- Production image: nginx; `docker-entrypoint.sh` writes `runtime-config.js` from `API_BASE_URL`, `OKTA_ISSUER`, `OKTA_CLIENT_ID`. Never bake environment URLs into the build.

## Infrastructure conventions

- `infra/bicep/main.bicep` is the only entry point; modules take `location`, `tags`, and explicit names. Names are computed once in `main.bicep`.
- Role assignments are **not** in Bicep (`infra/scripts/bootstrap.ps1` does them) so a Contributor-only pipeline identity can re-run the template.
- SQL is Entra-only; the admin is set by `principalId`. The runtime connection string uses the runtime identity's `clientId` as `User Id`.
- Phase 6 modules (`network.bicep`, `privateEndpoint.bicep`) exist but are not referenced until that phase.
- `deploy.yml` is `workflow_dispatch` only and has no secrets — cloud auth is OIDC via the `dev` GitHub Environment's variables. The same variables carry `OKTA_ISSUER`, `OKTA_CLIENT_ID`, `BOOTSTRAP_CURATOR` into Bicep; the API app always runs with `Auth__Enabled=true`.

## Cost rule

The Azure credit expires 2026-09-21. Any session that creates cloud resources ends with `./infra/scripts/teardown.ps1`.

## Phase status

Phase 0 tooling ✅ · Phase 1 ✅ · Phase 2 ✅ (code; real sign-in verified by hand) · Phases 3-7 see `PROJECT_PLAN.md`.
