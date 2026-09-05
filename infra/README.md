# Infrastructure

Bicep templates for one GameShelf environment, plus the scripts for the few things Bicep
deliberately does not own.

```
infra/
├── bicep/
│   ├── main.bicep                  orchestrates the modules below (resource-group scope)
│   ├── env/dev.bicepparam          per-environment parameters
│   └── modules/
│       ├── identity.bicep          deploy + runtime managed identities, GitHub federated credential
│       ├── monitoring.bicep        Log Analytics + Application Insights
│       ├── acr.bicep               container registry (Basic)
│       ├── sql.bicep               SQL server (Entra-only auth) + serverless database
│       ├── appServicePlan.bicep    Linux plan (B1; S1+ for slots)
│       ├── appService-api.bicep    API container app (+ optional staging slot)
│       ├── appService-web.bicep    web container app
│       ├── network.bicep           PHASE 6 — VNet, subnets, NSGs, private DNS zones (not wired in)
│       └── privateEndpoint.bicep   PHASE 6 — reusable private endpoint (not wired in)
└── scripts/
    ├── bootstrap.ps1               create RG → deploy → role assignments (run once as Owner)
    └── teardown.ps1                delete the RG (run at the end of every session)
```

## Identities

| Identity | Used by | Rights |
|---|---|---|
| `id-gh-oidc-<env>` (deploy) | GitHub Actions via OIDC; SQL Entra admin | Contributor on the resource group |
| `id-gameshelf-app-<env>` (runtime) | Both App Services | AcrPull on the registry; `db_datareader`/`db_datawriter` in the database |

Neither identity has a password. The deploy identity's federated credential trusts tokens whose
subject is exactly `repo:<owner>/<repo>:environment:<env>`.

## First deploy (Phase 3)

Budget guardrail first — the free credit has a hard expiry. Create it in the portal: the
`az consumption budget create` command cannot attach alert recipients, so a CLI-made budget never emails anyone.

1. Azure Portal → **Cost Management + Billing** → **Budgets** → **Add**
2. Scope: the subscription. Name `gameshelf-guardrail`, reset period Monthly, amount ~50 USD, expiry 2026-12-31
3. Alert conditions: actual cost at 50 %, 80 % and 100 %, with your email as the recipient

```powershell
az login
az account set --subscription <id>

./infra/scripts/bootstrap.ps1                       # RG + Bicep + role assignments
./infra/scripts/bootstrap.ps1 -GithubRepository "<owner>/gameshelf"   # Phase 4: adds the federated credential
```

Preview any later change before applying it:

```powershell
az deployment group what-if --resource-group rg-gameshelf-dev-wus2 --parameters infra/bicep/env/dev.bicepparam
```

## Every session

```powershell
./infra/scripts/teardown.ps1     # at the end
./infra/scripts/bootstrap.ps1    # at the start of the next one (or run the Deploy workflow)
```

Bicep is declarative and idempotent, so recreating the environment is a few minutes of waiting,
not a rebuild. What you pay for is wall-clock time that resources exist — not deployments.

## Phase toggles (in `env/dev.bicepparam`)

| Phase | Change |
|---|---|
| 5 — slots | `appServicePlanSku = 'S1'`, `enableStagingSlot = true` |
| 6 — private network | `sqlPublicNetworkAccess = 'Disabled'`, wire `network.bicep` + `privateEndpoint.bicep` into `main.bicep`, add VNet integration to both apps, switch migrations to the ACI job |

## Compile locally

```powershell
az bicep build --file infra/bicep/main.bicep
az bicep build-params --file infra/bicep/env/dev.bicepparam
```
