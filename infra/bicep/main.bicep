// GameShelf — environment deployment (resource-group scope).
//
// Deploy manually (Phase 3):
//   az group create --name rg-gameshelf-dev-wus2 --location westus2
//   az deployment group what-if --resource-group rg-gameshelf-dev-wus2 --parameters infra/bicep/env/dev.bicepparam
//   az deployment group create  --resource-group rg-gameshelf-dev-wus2 --parameters infra/bicep/env/dev.bicepparam
//
// Module order: identity → monitoring → acr → sql → plan → api/web.
// Role assignments are intentionally NOT here — see infra/scripts/bootstrap.ps1 and infra/README.md.
// Phase 6 (private networking) modules exist under modules/ but are not wired in yet.

targetScope = 'resourceGroup'

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

@description('Short environment name used in resource names (dev, stg, prd).')
@minLength(2)
@maxLength(5)
param environmentName string = 'dev'

@description('Product name used as the stem of every resource name.')
@minLength(3)
@maxLength(12)
param baseName string = 'gameshelf'

@description('Azure region. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('App Service Plan SKU. B1 is the cheapest tier that runs containers; deployment slots (Phase 5) need S1 or higher.')
@allowed(['B1', 'B2', 'S1', 'P0v3', 'P1v3'])
param appServicePlanSku string = 'B1'

@description('Fully-qualified API container image. Defaults to a public placeholder so the first deploy succeeds before ACR has any images.')
param apiImage string = 'mcr.microsoft.com/dotnet/samples:aspnetapp'

@description('Fully-qualified web container image. Defaults to a public placeholder so the first deploy succeeds before ACR has any images.')
param webImage string = 'mcr.microsoft.com/dotnet/samples:aspnetapp'

@description('SQL database pricing model. GP_S_Gen5 = serverless with auto-pause (idle time is nearly free). Basic = 5 DTU fixed.')
@allowed(['GP_S_Gen5', 'Basic'])
param sqlSku string = 'GP_S_Gen5'

@description('Public network access on the SQL server. Enabled for Phases 3-5, Disabled once private endpoints exist (Phase 6).')
@allowed(['Enabled', 'Disabled'])
param sqlPublicNetworkAccess string = 'Enabled'

@description('Your workstation public IP, allowed through the SQL firewall for local tooling. Empty = no rule.')
param clientIpAddress string = ''

@description('GitHub repository (owner/name) that may deploy via OIDC. Empty = no federated credential (Phase 4 adds it).')
param githubRepository string = ''

@description('GitHub Environment name in the federated credential subject.')
param githubEnvironment string = environmentName

@description('Create the "staging" deployment slot on the API app (Phase 5). Requires a Standard+ plan.')
param enableStagingSlot bool = false

@description('Tags applied to every resource.')
param tags object = {
  project: baseName
  environment: environmentName
  managedBy: 'bicep'
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

// Globally-unique names (ACR, SQL server, App Service) get a short stable suffix derived from the RG id.
var uniqueSuffix = toLower(take(uniqueString(resourceGroup().id), 6))

var names = {
  deployIdentity: 'id-gh-oidc-${environmentName}'
  runtimeIdentity: 'id-${baseName}-app-${environmentName}'
  logAnalytics: 'log-${baseName}-${environmentName}'
  appInsights: 'appi-${baseName}-${environmentName}'
  acr: toLower(take('acr${replace(baseName, '-', '')}${environmentName}${uniqueSuffix}', 50))
  sqlServer: toLower('sql-${baseName}-${environmentName}-${uniqueSuffix}')
  sqlDatabase: 'sqldb-${baseName}-${environmentName}'
  appServicePlan: 'asp-${baseName}-${environmentName}'
  apiApp: toLower('app-${baseName}-api-${environmentName}-${uniqueSuffix}')
  webApp: toLower('app-${baseName}-web-${environmentName}-${uniqueSuffix}')
}

// Hostnames are deterministic, so the API can learn the web origin (CORS) and the web can learn
// the API URL without a circular module dependency.
var apiUrl = 'https://${names.apiApp}.azurewebsites.net'
var webUrl = 'https://${names.webApp}.azurewebsites.net'

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

module identity 'modules/identity.bicep' = {
  name: 'identity'
  params: {
    location: location
    tags: tags
    deployIdentityName: names.deployIdentity
    runtimeIdentityName: names.runtimeIdentity
    githubRepository: githubRepository
    githubEnvironment: githubEnvironment
  }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    tags: tags
    logAnalyticsName: names.logAnalytics
    appInsightsName: names.appInsights
  }
}

module acr 'modules/acr.bicep' = {
  name: 'acr'
  params: {
    location: location
    tags: tags
    name: names.acr
  }
}

module sql 'modules/sql.bicep' = {
  name: 'sql'
  params: {
    location: location
    tags: tags
    serverName: names.sqlServer
    databaseName: names.sqlDatabase
    sku: sqlSku
    publicNetworkAccess: sqlPublicNetworkAccess
    clientIpAddress: clientIpAddress
    // Entra admin = the deploy identity, referenced by *principalId* (object id), never clientId.
    adminLogin: identity.outputs.deployIdentityName
    adminPrincipalId: identity.outputs.deployPrincipalId
  }
}

module plan 'modules/appServicePlan.bicep' = {
  name: 'appServicePlan'
  params: {
    location: location
    tags: tags
    name: names.appServicePlan
    sku: appServicePlanSku
  }
}

// Passwordless connection string: the runtime identity's *clientId* is the SQL "User Id".
var sqlConnectionString = 'Server=tcp:${sql.outputs.serverFqdn},1433;Initial Catalog=${sql.outputs.databaseName};Authentication=Active Directory Managed Identity;User Id=${identity.outputs.runtimeClientId};Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'

module api 'modules/appService-api.bicep' = {
  name: 'appService-api'
  params: {
    location: location
    tags: tags
    name: names.apiApp
    appServicePlanId: plan.outputs.id
    runtimeIdentityId: identity.outputs.runtimeIdentityId
    runtimeIdentityClientId: identity.outputs.runtimeClientId
    image: apiImage
    sqlConnectionString: sqlConnectionString
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    allowedCorsOrigin: webUrl
    enableStagingSlot: enableStagingSlot
  }
}

module web 'modules/appService-web.bicep' = {
  name: 'appService-web'
  params: {
    location: location
    tags: tags
    name: names.webApp
    appServicePlanId: plan.outputs.id
    runtimeIdentityId: identity.outputs.runtimeIdentityId
    runtimeIdentityClientId: identity.outputs.runtimeClientId
    image: webImage
    apiBaseUrl: apiUrl
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
  }
}

// ---------------------------------------------------------------------------
// Outputs (consumed by scripts and the deploy workflow)
// ---------------------------------------------------------------------------

output resourceGroupName string = resourceGroup().name
output deployIdentityClientId string = identity.outputs.deployClientId
output deployIdentityPrincipalId string = identity.outputs.deployPrincipalId
output runtimeIdentityName string = identity.outputs.runtimeIdentityName
output runtimeIdentityPrincipalId string = identity.outputs.runtimePrincipalId
output acrName string = acr.outputs.name
output acrLoginServer string = acr.outputs.loginServer
output sqlServerName string = sql.outputs.serverName
output sqlServerFqdn string = sql.outputs.serverFqdn
output sqlDatabaseName string = sql.outputs.databaseName
output apiAppName string = api.outputs.name
output apiUrl string = apiUrl
output webAppName string = web.outputs.name
output webUrl string = webUrl
