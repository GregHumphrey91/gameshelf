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

// Images are supplied by the deploy workflow (--parameters apiImage=... webImage=...).
// The defaults in main.bicep are public placeholders for the very first deploy.
