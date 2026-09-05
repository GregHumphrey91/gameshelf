# GameShelf

A small personal video-game collection tracker — and a practice ground for a production-style
Azure deployment pipeline (managed identities, OIDC federation from GitHub, health-gated slot
swaps, private networking). See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the phased plan and
[infra/README.md](infra/README.md) for cloud deployment.

**Stack:** ASP.NET Core 8 Web API + EF Core · React 19 + Vite + TypeScript · SQL Server / Azure SQL · Docker · Bicep · GitHub Actions

## Prerequisites

- .NET 8 SDK
- Node.js 20+ (22 recommended)
- Docker Desktop

## Run it locally

### Inner loop (hot reload)

```powershell
npm run setup        # once: dotnet tools + restore, npm ci, Playwright browser

npm run dev:api      # terminal 1 — starts SQL Server if needed, API on http://localhost:8080 (Swagger at /swagger)
npm run dev:web      # terminal 2 — SPA on http://localhost:5173
```

### Whole stack in containers

```powershell
npm run dev          # docker compose up --build → web http://localhost:3000, api http://localhost:8080
```

The local SQL `sa` password is `GameShelf_Dev_Pa55word!` (override with a `.env` file — see
`.env.example`). It exists only for the local container; cloud environments have no SQL passwords at all.

## Tests

All commands run from the repository root (`package.json` is the task runner) and start the SQL
container for you when they need it. First time only: `npm run setup`.

| Command | Suite | Needs |
|---|---|---|
| `npm run test:backend:unit` | unit + contract (`tests/GameShelf.Api.Tests`) | nothing |
| `npm run test:backend:integration` | database-backed (`tests/GameShelf.Api.IntegrationTests`) | Docker |
| `npm run test:frontend` | Vitest + Testing Library, API mocked with MSW | nothing |
| `npm run test:e2e` | Playwright — starts the API and Vite itself, then drives the browser | Docker |
| `npm test` | everything except E2E | Docker |
| `npm run test:all` | everything | Docker |

### Inside containers

The same suites can run entirely inside Docker — no .NET SDK, Node, or browsers needed on the host,
and exactly what CI's `containers` job runs. `docker-compose.test.yml` is a separate stack (own project
name, no published ports, throwaway SQL Server) so it never interferes with the dev stack.

| Command | What starts | Results |
|---|---|---|
| `npm run test:docker:backend` | `sqlserver` → `backend-tests` (unit + contract + integration) | `test-results/backend/*.trx` |
| `npm run test:docker:frontend` | `frontend-tests` (Vitest) | console |
| `npm run test:docker:e2e` | `sqlserver` → `api` → `web` → `e2e` (Playwright against the real images) | `src/gameshelf-web/playwright-report/` |
| `npm run test:docker` | all three, one after another, with a pass/fail summary | both |

Each command is `docker compose -f docker-compose.test.yml --profile <suite> up --build
--abort-on-container-exit --exit-code-from <runner>` followed by `down --volumes`, driven by
`scripts/docker-test.mjs` so it behaves the same from PowerShell, cmd, bash and CI. The runner
container's exit code is the command's exit code. If a run is interrupted, `npm run test:docker:down`
removes whatever is left.

Other root scripts: `npm run lint` (ESLint + `tsc`), `npm run build`, `npm run bicep:build`,
`npm run db:up` / `db:down` / `db:reset` (wipes the local database), `npm run dev` (whole stack in
containers), `npm run dev:api` / `dev:web` (hot-reload servers on :8080 / :5173).

## API

| Method | Route | Notes |
|---|---|---|
| GET | `/api/games` | newest first |
| GET | `/api/games/{id}` | 404 if missing |
| POST | `/api/games` | 201 + `Location`; 400 problem+json on validation errors |
| PUT | `/api/games/{id}` | 204 / 404 |
| DELETE | `/api/games/{id}` | 204 / 404 |
| GET | `/health/live` | always 200 |
| GET | `/health/ready` | 200 only if `SELECT 1` succeeds against the database, else 503 |

## Database migrations

```powershell
dotnet tool restore                                                            # once
dotnet ef migrations add <Name> --project src/GameShelf.Api --output-dir Data/Migrations
dotnet ef database update      --project src/GameShelf.Api                      # local only
```

In cloud environments migrations are applied by the deploy workflow, never on app startup.

## Layout

```
src/GameShelf.Api           API (Controllers, Data, Models, Health, Auth)
src/gameshelf-web           SPA (src/api, components, hooks, test, types; e2e/); Dockerfile.e2e = Playwright runner
tests/                      GameShelf.Api.Tests (unit + contract), GameShelf.Api.IntegrationTests; Dockerfile = backend runner
scripts/                    docker-test.mjs — runs the suites in docker-compose.test.yml
infra/                      Bicep modules, bootstrap/teardown scripts
.github/workflows           ci.yml (always), deploy.yml (manual, Phase 4+)
```
