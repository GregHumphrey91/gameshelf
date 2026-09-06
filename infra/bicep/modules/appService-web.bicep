// Web — nginx container serving the built SPA. API_BASE_URL and the sign-in settings are injected
// at container start (see src/gameshelf-web/docker-entrypoint.sh), so the same image works in every environment.

param location string
param tags object
param name string
param appServicePlanId string
param runtimeIdentityId string
param runtimeIdentityClientId string
param image string
param apiBaseUrl string

@description('OpenID Connect issuer the SPA signs in against.')
param oktaIssuer string

@description('Client id of the Single-Page App (public — PKCE, no secret).')
param oktaClientId string

@secure()
param appInsightsConnectionString string

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
    siteConfig: {
      linuxFxVersion: 'DOCKER|${image}'
      acrUseManagedIdentityCreds: true
      acrUserManagedIdentityID: runtimeIdentityClientId
      alwaysOn: true
      http20Enabled: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'WEBSITES_PORT', value: '80' }
        { name: 'API_BASE_URL', value: apiBaseUrl }
        { name: 'OKTA_ISSUER', value: oktaIssuer }
        { name: 'OKTA_CLIENT_ID', value: oktaClientId }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
        { name: 'DOCKER_ENABLE_CI', value: 'false' }
      ]
    }
  }
}

output name string = site.name
output defaultHostName string = site.properties.defaultHostName
