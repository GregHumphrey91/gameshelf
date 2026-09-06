// API — Web App for Containers, running as the runtime managed identity.
// Pulls from ACR with that identity (no registry password) and connects to SQL with it (no DB password).
// Optional "staging" slot for health-gated swaps (Phase 5).

param location string
param tags object
param name string
param appServicePlanId string
param runtimeIdentityId string
param runtimeIdentityClientId string
param image string

@secure()
param sqlConnectionString string

@secure()
param appInsightsConnectionString string

@description('Origin the SPA is served from, allowed via CORS.')
param allowedCorsOrigin string

@description('OpenID Connect issuer whose tokens the API accepts. Signing keys are fetched from its JWKS endpoint.')
param authIssuer string

@description('Audience expected in access tokens.')
param authAudience string = 'api://default'

@description('Email or subject auto-created as the first Curator on first sign-in. Empty = none.')
param bootstrapCurator string = ''

param enableStagingSlot bool = false

// Shared by the production site and the slot so they never drift apart.
var siteConfig = {
  linuxFxVersion: 'DOCKER|${image}'
  acrUseManagedIdentityCreds: true
  acrUserManagedIdentityID: runtimeIdentityClientId
  alwaysOn: true
  http20Enabled: true
  ftpsState: 'Disabled'
  minTlsVersion: '1.2'
  // Platform-level probe: unhealthy instances are recycled. Liveness only — a database outage
  // should not make the platform restart the app.
  healthCheckPath: '/health/live'
  appSettings: [
    { name: 'WEBSITES_PORT', value: '8080' }
    { name: 'ASPNETCORE_ENVIRONMENT', value: 'Production' }
    { name: 'ConnectionStrings__GameShelf', value: sqlConnectionString }
    { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
    { name: 'Cors__AllowedOrigins__0', value: allowedCorsOrigin }
    { name: 'Database__MigrateOnStartup', value: 'false' }
    // Sign-in is mandatory in the cloud: the API refuses to start with Auth__Enabled=false in Production.
    { name: 'Auth__Enabled', value: 'true' }
    { name: 'Auth__Issuer', value: authIssuer }
    { name: 'Auth__Audience', value: authAudience }
    { name: 'Auth__BootstrapCurators__0', value: bootstrapCurator }
    // Slot swap gate: Azure pings this path on the *source* slot and refuses to swap unless it
    // answers with one of these statuses. /health/ready does a real database round-trip.
    { name: 'WEBSITE_SWAP_WARMUP_PING_PATH', value: '/health/ready' }
    { name: 'WEBSITE_SWAP_WARMUP_PING_STATUSES', value: '200' }
    { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
    { name: 'DOCKER_ENABLE_CI', value: 'false' }
  ]
}

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${runtimeIdentityId}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    clientAffinityEnabled: false
    keyVaultReferenceIdentity: runtimeIdentityId
    siteConfig: siteConfig
  }
}

resource stagingSlot 'Microsoft.Web/sites/slots@2023-12-01' = if (enableStagingSlot) {
  parent: site
  name: 'staging'
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${runtimeIdentityId}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    clientAffinityEnabled: false
    keyVaultReferenceIdentity: runtimeIdentityId
    siteConfig: siteConfig
  }
}

output name string = site.name
output defaultHostName string = site.properties.defaultHostName
output stagingSlotName string = enableStagingSlot ? 'staging' : ''
