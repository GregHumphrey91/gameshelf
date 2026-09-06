using '../main.bicep'

param environmentName = 'dev'
param baseName = 'gameshelf'
param appServicePlanSku = 'B1' // switch to 'S1' together with enableStagingSlot in Phase 5
param sqlSku = 'GP_S_Gen5'
param sqlPublicNetworkAccess = 'Enabled' // 'Disabled' in Phase 6
param enableStagingSlot = false

// Override at deploy time rather than committing them:
//   --parameters clientIpAddress=$(curl -s https://api.ipify.org) githubRepository=<owner>/gameshelf
param clientIpAddress = ''
param githubRepository = ''

// Sign-in. The issuer and client id are public identifiers (PKCE), but they are per-org, so the
// deploy workflow supplies them from the GitHub Environment variables OKTA_ISSUER / OKTA_CLIENT_ID /
// BOOTSTRAP_CURATOR. For a manual deploy pass them the same way:
//   --parameters oktaIssuer=https://<org>.okta.com/oauth2/default oktaClientId=<id> bootstrapCurator=<your email>
param oktaIssuer = ''
param oktaClientId = ''
param authAudience = 'api://default'
param bootstrapCurator = ''

// Images are supplied by the deploy workflow (--parameters apiImage=... webImage=...).
// The defaults in main.bicep are public placeholders for the very first deploy.
