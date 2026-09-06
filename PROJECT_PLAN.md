# GameShelf — Project Plan

A personal video-game collection tracker, built as a vehicle for practising a production-grade
Azure deployment pipeline: managed identities instead of passwords, workload identity federation
from GitHub, health-gated deployment-slot swaps, OIDC login with roles owned by the application,
and — as a stretch — a fully private network path to the database.

Each phase has explicit deliverables and an **Acceptance** line that says when it is done.
Work through them in order, one session at a time.

---

## 0. Ground rules

**Cost.** This runs on a free-credit subscription that expires **2026-09-21**. Nothing in Phases
0-2 costs anything. From Phase 3 on, adopt the habit in [§6](#6-cost-management): create the
environment at the start of a session, delete it at the end. Bicep makes recreation cheap;
leaving resources running overnight does not.

**Stack decisions (made; don't revisit unless something is genuinely blocking):**

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite (SPA), TypeScript | Familiar; fast feedback loop |
| Backend | ASP.NET Core Web API (.NET 8) | Typed, first-class Azure/EF tooling |
| ORM / migrations | EF Core Code-First | Migration history lives in source control; `dotnet ef` bundles run anywhere |
| Database | Azure SQL Database (serverless, auto-pause) | Entra-only auth; cheapest when idle |
| Identity provider | Okta Integrator Free Plan (OIDC, Authorization Code + PKCE) | Free developer org; auto-expires after 180 days of inactivity — fine for this |
| Containers | Docker → Azure Container Registry | Practise registry auth with managed identity |
| Compute | Azure App Service for Containers (Linux) | Deployment slots and warm-up gating are built in |
| CI/CD | GitHub Actions with OIDC federation | No stored cloud credentials |
| IaC | Bicep | Declarative, idempotent, native to Azure |

**Testing is not optional.** Every phase keeps these five suites green:

| Suite | Where | What it proves |
|---|---|---|
| Backend unit | `tests/GameShelf.Api.Tests/Unit` | Controller / mapping logic in isolation (NSubstitute) |
| Backend contract | `tests/GameShelf.Api.Tests/ContractTests` | Routes, status codes, JSON shape — real HTTP pipeline, every data dependency stubbed, database access is a test failure |
| Backend integration | `tests/GameShelf.Api.IntegrationTests` | Real CRUD round-trips against a real SQL Server; readiness check is genuine |
| Frontend unit | `src/gameshelf-web/src/**/*.test.tsx` | Components and hooks (Vitest + Testing Library); the API is mocked with MSW, never with `vi.mock('fetch')` |
| Frontend E2E | `src/gameshelf-web/e2e` | Playwright against the real API + database |

---

## 1. Target architecture

### Phases 1-5 (public-first)

```
GitHub Actions (OIDC login — no secret)
      │ az acr build                    │ az deployment group create
      ▼                                 ▼
 ACR (Basic, no admin user)     rg-gameshelf-dev-wus2
      │ AcrPull via runtime identity     │
      ▼                                 ▼
 App Service: gameshelf-api  ──EF Core, MI auth──▶  Azure SQL (public, firewall: Azure services + your IP)
 App Service: gameshelf-web  (nginx serving the SPA; API URL injected at container start)

 Identities
   id-gh-oidc-dev        deploy   Contributor on the RG · SQL Entra admin · trusted by GitHub OIDC
   id-gameshelf-app-dev  runtime  AcrPull · db_datareader/db_datawriter · assigned to both apps

 Observability: Log Analytics (1 GB/day cap) + Application Insights
```

SQL is publicly reachable but firewall-restricted in these phases so the app, pipeline and slot
swap can be proven without networking in the critical path. Training wheels, not a destination.

### Phase 6 (private — stretch goal)

```
 VNet 10.60.0.0/22
   snet-appsvc    10.60.0.0/23   App Services, VNet-integrated (outbound)
   snet-pe        10.60.2.0/24   private endpoints
   snet-migration 10.60.3.0/28   ephemeral Azure Container Instance for migrations

 App Services ──▶ private endpoint ──▶ Azure SQL (publicNetworkAccess: Disabled)

 Private DNS zone privatelink.database.windows.net, linked to the VNet:
   the same hostname answers with a private IP from inside, and nothing from outside.

 GitHub Actions cannot reach SQL → starts a container in snet-migration → applies migrations → deletes it
```

---

## 2. Repository layout

```
gameshelf/
├── PROJECT_PLAN.md               this file
├── README.md                     how to run it
├── CLAUDE.md                     conventions for AI-assisted sessions
├── GameShelf.sln
├── docker-compose.yml            local stack: sqlserver + api + web
├── src/
│   ├── GameShelf.Api/            ASP.NET Core Web API
│   │   ├── Controllers/          GamesController, HealthController
│   │   ├── Data/                 DbContext, repository, Migrations/
│   │   ├── Models/               Game entity + DTOs
│   │   ├── Health/               readiness probe (real DB round-trip)
│   │   ├── Auth/                 Phase 2
│   │   └── Dockerfile
│   └── gameshelf-web/            React + Vite SPA
│       ├── src/                  api/, components/, hooks/, test/ (MSW), types/
│       ├── e2e/                  Playwright specs
│       └── Dockerfile            nginx + runtime-config.js
├── tests/
│   ├── GameShelf.Api.Tests/                 unit + contract
│   └── GameShelf.Api.IntegrationTests/      database-backed
├── infra/
│   ├── bicep/                    main.bicep, modules/, env/dev.bicepparam
│   └── scripts/                  bootstrap.ps1, teardown.ps1
└── .github/workflows/
    ├── ci.yml                    all test suites + image builds + Bicep compile (no cloud access)
    └── deploy.yml                OIDC → ACR build → Bicep → migrations → rollout (manual until Phase 4)
```

---

## 3. Concept cross-reference

| What you build | Concept it rehearses |
|---|---|
| `id-gh-oidc-dev` + federated credential | Workload identity federation; the subject string must match exactly |
| Role assignments in `bootstrap.ps1`, not Bicep | Contributor can deploy resources but cannot grant roles; separation of duties |
| Connection string with `Authentication=Active Directory Managed Identity` | Passwordless database access |
| SQL Entra admin set by **principalId** | Object id vs client id — the classic mix-up |
| `/health/ready` doing a real `SELECT 1` | Readiness that fails when the database is unreachable |
| `WEBSITE_SWAP_WARMUP_PING_PATH=/health/ready` on the staging slot | A swap that refuses to promote a broken build |
| PKCE in the SPA | Authorization Code flow for public clients — no client secret in the browser |
| Roles read from your own `Users` table | The identity provider proves *who*; your database decides *what they may do* |
| Container in `snet-migration` for migrations | Why a private database cannot be migrated from a hosted runner |
| `privatelink.database.windows.net` zone | Split-horizon DNS: same name, different answer by network position |
| `az provider register` in Phase 6 | Resource providers must be registered before first use |

---

## 4. Phases

### Phase 0 — Accounts & tooling ✅ (tooling) / ⏳ (accounts)

- [x] .NET 8 SDK, Node 20+, Docker Desktop
- [x] Git repository initialised
- [x] `gh` CLI working
- [x] `az` CLI on PATH in your shell (`az account show` returns your subscription)
- [x] Okta Integrator Free Plan org; one OIDC application (type: Single-Page App, PKCE); note the issuer URL and client id
- [ ] GitHub repository created and this repo pushed
- [ ] **Budget alert before creating any Azure resource** (command in `infra/README.md`)

**Acceptance:** `az account show` works; you have an Okta org and app; the budget alert exists.

### Phase 1 — Local app skeleton ✅

- [x] `docker-compose.yml` with SQL Server (Linux container) as the local stand-in for Azure SQL
- [x] `GameShelf.Api`: `Game` entity (title, platform, condition, estimated value, added date), EF Core Code-First, `InitialCreate` migration, full CRUD
- [x] `/health/live` (static) and `/health/ready` (real database round-trip with a 5 s timeout)
- [x] `gameshelf-web`: list / add / edit / delete against the local API with plain `fetch`
- [x] All five test suites, wired into `ci.yml`
- [x] Dockerfiles for both apps; Bicep and deploy workflow scaffolded (inert until Phase 3/4)

**Acceptance:** `docker compose up --build` → full CRUD works in the browser at http://localhost:3000; `dotnet test` and `npm test` / `npm run test:e2e` are green.

### Phase 2 — Okta OIDC + PKCE (≈1 session)

- [x] SPA: `@okta/okta-auth-js` only (no router, no React binding), Authorization Code + PKCE, `/login/callback` handled at boot, access token attached as `Authorization: Bearer` by the API client (token accessor lives outside React in `src/api/token.ts`, so `src/api/` stays framework-free)
- [x] Auth-disabled "local mode" (`Auth:Enabled=false`; SPA has no issuer/client id) so unit, contract, integration and E2E tests run without a real identity provider. Refused in Production.
- [x] API: JWT bearer validation — issuer and audience from configuration, signing keys from the issuer's JWKS
- [x] `Users` table (`OktaSubject`, `Email`, `Role`) + migration. Resolve the caller by `sub` and read the role **from this table**, never from token claims. Unknown subject → 403. `Auth:BootstrapCurators` creates the first Curator on first sign-in.
- [x] Policies: `Reader` may list/get; `Curator` may create/update/delete; `GET /api/me` for any signed-in caller
- [x] Register `http://localhost:5173/login/callback` in Okta (add the deployed URL in Phase 3 when you hit `redirect_uri mismatch`)
- [x] Tests: unit tests for role resolution and claims transformation; contract tests for 401/403/`/api/me`; integration tests for the `Users` repository and bootstrap; SPA tests for signed-out / no-access / Reader / Curator; E2E runs with auth disabled
- [ ] Hand check: sign in locally with the real org (README → "Signing in with a real identity provider")

**Acceptance:** log in locally via Okta; unauthenticated API calls get 401; a user in the `Users` table gets the role that table says; a valid token for an unknown user gets 403.

### Phase 3 — Azure infrastructure, public-first (≈1-2 sessions)

Templates already exist under `infra/bicep`. This phase is about running them and fixing what reality disagrees with.

- [ ] `az login`; set the subscription; create the budget alert
- [ ] `./infra/scripts/bootstrap.ps1` — resource group, identities, monitoring, ACR, SQL (Entra-only, serverless, firewall for Azure services + your IP), plan (B1), both apps with placeholder images, role assignments
- [ ] Price-check the SQL and App Service SKUs in the Azure Pricing Calculator before leaving them running
- [ ] `az acr build` both images manually; point the apps at them (`az webapp config set --linux-fx-version`)
- [ ] Apply migrations from your workstation (`dotnet ef database update` with `Authentication=Active Directory Default` as yourself — you'll need to add yourself as a DB user via the Entra admin identity, or temporarily make your own account the admin) and create the runtime identity's DB user (SQL in `deploy.yml`)
- [ ] Add the deployed web origin to the API's CORS and to Okta's redirect URIs

**Acceptance:** `az deployment group what-if` is clean; both apps run your images; the API reaches SQL with the managed identity — no password anywhere.

### Phase 4 — GitHub Actions CI/CD via OIDC (≈1 session)

- [ ] Re-run bootstrap with `-GithubRepository <owner>/gameshelf` to create the federated credential (`repo:<owner>/gameshelf:environment:dev`)
- [ ] GitHub Environment `dev` with **variables** (not secrets — none of these are sensitive): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `ACR_NAME` — `bootstrap.ps1` prints them
- [ ] Run `deploy.yml` via *workflow_dispatch*. Expect to debug: subject-claim mismatch (`AADSTS70021`), missing role, firewall timing
- [ ] Once green, add `push: branches: [main]` as a trigger if you want continuous deployment

**Acceptance:** a manual dispatch deploys end-to-end with zero stored secrets and the deployed app works.

### Phase 5 — Deployment slot + health-gated swap (≈1 session)

- [ ] `appServicePlanSku = 'S1'`, `enableStagingSlot = true` in `dev.bicepparam`; redeploy
- [ ] Dispatch `deploy.yml` with `use_staging_slot = true`; watch the swap wait for `/health/ready`
- [ ] **Break it on purpose:** deploy a build whose readiness check fails (e.g. wrong database name in the slot's connection string) and confirm the swap is refused and production is untouched. This is the most instructive failure in the plan
- [ ] Revert the plan to B1 and `enableStagingSlot = false` at the end of the session if cost matters more than keeping the slot around

**Acceptance:** a healthy build swaps with no downtime; a broken build is rejected.

### Phase 6 — Private network (stretch, ≈2-3 sessions)

Start only when Phases 1-5 are reliable.

- [ ] `az provider register --namespace Microsoft.ContainerInstance --wait`
- [ ] Wire `modules/network.bicep` into `main.bicep`; add `virtualNetworkSubnetId` + `vnetRouteAllEnabled` to both apps
- [ ] Private endpoint for SQL via `modules/privateEndpoint.bicep` (groupId `sqlServer`); `sqlPublicNetworkAccess = 'Disabled'`
- [ ] ACR: either keep it public with managed-identity auth (Basic tier), or move to Premium and add a second private endpoint — decide with the pricing calculator open
- [ ] Migration image (`Dockerfile.migrate`: EF bundle + `grant.sql`); replace the three database steps in `deploy.yml` with the ACI job sketched at the bottom of that file
- [ ] Confirm the app works, and confirm that Azure Data Studio on your laptop **cannot** connect any more — not "wrong password", but no route

**Acceptance:** everything from Phases 1-5 still works; SQL has no path from the public internet.

### Phase 7 — Optional polish

- [ ] Custom domain + App Service managed certificate (bind without TLS → issue certificate → re-bind with the thumbprint)
- [ ] A second GitHub Environment (`stg`) with its own identity and federated credential, to practise environment separation in one subscription
- [ ] Tighter budget threshold as the credit expiry approaches

---

## 5. Definition of done, per phase

Paste the phase's **Acceptance** line into the session as the goal. A phase is done when that line is
true *and* `ci.yml` is green.

## 6. Cost management

Prices change; check the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
for your region before deploying. Directionally: App Service **B1** and SQL **serverless with
auto-pause** are the cheap options; the free **F1** plan cannot run deployment slots. Private
endpoints bill per hour per endpoint plus data processed, which is one more reason Phase 6 is last.

At the end of every working session:

```powershell
./infra/scripts/teardown.ps1
```

At the start of the next, `./infra/scripts/bootstrap.ps1` (or dispatch `deploy.yml`) recreates
everything from source. The environment is disposable by design.

## 7. Working with an AI assistant

1. Open the repo and say which phase you're on and paste its Acceptance line.
2. When something fails in Azure or GitHub Actions, paste the **exact** error text
   (`AADSTS70021`, `MissingSubscriptionRegistration`, …). The specific string is the useful part.
3. Keep the five test suites green; add tests with every behaviour change.
