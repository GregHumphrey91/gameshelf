# GameShelf

A small personal video-game collection tracker — and a practice ground for a production-style
Azure deployment pipeline (managed identities, OIDC federation from GitHub, health-gated slot
swaps, private networking). See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the phased plan and
[infra/README.md](infra/README.md) for cloud deployment.

**Stack:** ASP.NET Core 8 Web API + EF Core · React 19 + Vite + TypeScript · SQL Server / Azure SQL · Docker · Bicep · GitHub Actions

## Prerequisites

- Docker Desktop — the only requirement for running the app and every test suite
- .NET 8 SDK and Node.js 22 — only for the hot-reload inner loop and migrations

## Run it locally

### Inner loop (hot reload)

```powershell
npm run setup        # once: dotnet tools + restore, npm ci

npm run dev:api      # terminal 1 — starts SQL Server if needed, API on http://localhost:8080 (Swagger at /swagger)
npm run dev:web      # terminal 2 — SPA on http://localhost:5173
```

### Whole stack in containers

```powershell
npm run dev          # docker compose up --build → web http://localhost:3000, api http://localhost:8080
```

The local SQL `sa` password is `GameShelf_Dev_Pa55word!` (override with a `.env` file — see
`.env.example`). It exists only for the local container; cloud environments have no SQL passwords at all.

Both ways run in **local mode**: no sign-in, and the API treats every request as a local Curator.

## Sign-in and roles

Sign-in is OpenID Connect with Authorization Code + PKCE against an Okta org. The SPA is a public
client (no secret anywhere); it sends the access token as `Authorization: Bearer`, and the API validates
the token's issuer, audience and signature (keys fetched from the issuer's JWKS endpoint).

**What a token gets you is decided by the API's own `Users` table, not by token claims.**

| Caller | Result |
|---|---|
| No / invalid token | 401 on every `/api/*` route (health endpoints stay anonymous) |
| Valid token, subject not in `Users` | 403 (`/api/me` still answers, with `role: null`, so the SPA can say "no access yet") |
| `Users.Role = Reader` | GET `/api/games` |
| `Users.Role = Curator` | everything |

The first account is created automatically: any subject or email listed in `Auth:BootstrapCurators`
gets a `Curator` row on its first sign-in. After that, rows are managed in the database.

### Local mode (default)

`Auth:Enabled=false` (set in `appsettings.Development.json`) swaps the JWT handler for one that
authenticates everybody as `local-dev` with the `Curator` role, and the SPA hides the sign-in controls
when it has no issuer/client id. Every test suite runs this way. The API refuses to start in local mode
when `ASPNETCORE_ENVIRONMENT=Production`.

### Signing in with a real identity provider

You need, from your Okta org: the **issuer** (default authorization server:
`https://<org>.okta.com/oauth2/default`) and the **client id** of a Single-Page App whose sign-in
redirect URIs include `http://localhost:5173/login/callback` and `http://localhost:3000/login/callback`
and whose sign-out redirect URIs include `http://localhost:5173` and `http://localhost:3000`.
Both values are public identifiers; keep them out of the repo anyway because they are per-org.

Inner loop (`npm run dev:api` / `npm run dev:web`):

```powershell
# API — user secrets override appsettings.Development.json and are stored outside the repo
dotnet user-secrets set Auth:Enabled true                                   --project src/GameShelf.Api
dotnet user-secrets set Auth:Issuer https://<org>.okta.com/oauth2/default   --project src/GameShelf.Api
dotnet user-secrets set Auth:BootstrapCurators:0 you@example.com            --project src/GameShelf.Api

# SPA — src/gameshelf-web/.env.local (git-ignored)
VITE_OKTA_ISSUER=https://<org>.okta.com/oauth2/default
VITE_OKTA_CLIENT_ID=<client id>
```

Back to local mode: `dotnet user-secrets clear --project src/GameShelf.Api` and delete `.env.local`.

Containers (`npm run dev`): set `AUTH_ENABLED`, `OKTA_ISSUER`, `OKTA_CLIENT_ID` and `BOOTSTRAP_CURATOR`
in `.env` (see `.env.example`). The web image reads `OKTA_ISSUER` / `OKTA_CLIENT_ID` at container start,
like `API_BASE_URL`, so the same image serves every environment.

## Tests

Every suite runs inside Docker, and only there. There is no .NET SDK, Node, or browser requirement on
the host, and CI runs the exact same command. `docker-compose.test.yml` is a separate stack (own project
name, no published ports, throwaway SQL Server) so it never interferes with the dev stack.

| Command | What starts | Results |
|---|---|---|
| `npm run test:backend` | `sqlserver` → `backend-tests` (unit + contract + integration) | `test-results/backend/*.trx` |
| `npm run test:frontend` | `frontend-tests` (lint, format and typecheck, generated-types check, Vitest with the API mocked by MSW and the mocks checked against `infra/openapi.json`) | console |
| `npm run test:e2e` | `sqlserver` → `api` → `web` → `e2e` (Playwright against the real images) | `src/gameshelf-web/playwright-report/` |
| `npm test` | all three, one after another, with a pass/fail summary | both |

Each command is `docker compose -f docker-compose.test.yml --profile <suite> up --build
--abort-on-container-exit --exit-code-from <runner>` followed by `down --volumes`, driven by
`scripts/docker-test.mjs` so it behaves the same from PowerShell, cmd, bash and CI. The runner
container's exit code is the command's exit code. If a run is interrupted, `npm run test:down`
removes whatever is left.

`npm run ci:local` runs what CI runs: lint, every suite, and the Bicep build.

Other root scripts: `npm run lint` (ESLint + `tsc`), `npm run build`, `npm run bicep:build`,
`npm run db:up` / `db:down` / `db:reset` (wipes the local database), `npm run dev` (whole stack in
containers), `npm run dev:api` / `dev:web` (hot-reload servers on :8080 / :5173).

## API

| Method | Route | Requires | Notes |
|---|---|---|---|
| GET | `/api/me` | signed in | `{ subject, email, role }`; `role` is null for unknown accounts |
| GET | `/api/games` | Reader | newest first |
| GET | `/api/games/{id}` | Reader | 404 if missing |
| POST | `/api/games` | Curator | 201 + `Location`; 400 problem+json on validation errors |
| PUT | `/api/games/{id}` | Curator | 204 / 404 |
| DELETE | `/api/games/{id}` | Curator | 204 / 404 |
| GET | `/health/live` | — | always 200 |
| GET | `/health/ready` | — | 200 only if `SELECT 1` succeeds against the database, else 503 |

## Database migrations

```powershell
dotnet tool restore                                                            # once
dotnet ef migrations add <Name> --project src/GameShelf.Api --output-dir Data/Migrations
dotnet ef database update      --project src/GameShelf.Api                      # local only
```

In cloud environments migrations are applied by the deploy workflow, never on app startup.

## Layout

```
src/GameShelf.Api           API (Controllers, Data, Models, Health, Auth = JWT bearer + role resolution from the Users table)
src/gameshelf-web           SPA (src/api, auth, components, hooks, test, types; e2e/); Dockerfile.e2e = Playwright runner
tests/                      GameShelf.Api.Tests (unit + contract), GameShelf.Api.IntegrationTests; Dockerfile = backend runner
scripts/                    docker-test.mjs — runs the suites in docker-compose.test.yml
infra/                      Bicep modules, bootstrap/teardown scripts
.github/workflows           ci.yml (always), deploy.yml (manual, Phase 4+)
```
