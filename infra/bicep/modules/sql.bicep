// Azure SQL logical server + one database.
// Entra-only authentication: there is no SQL login, no SA password, nothing to leak.
// The Entra admin is a managed identity referenced by its principalId (object id).

param location string
param tags object
param serverName string
param databaseName string

@description('Display name for the Entra admin (the deploy identity name).')
param adminLogin string

@description('principalId (object id) of the Entra admin — NOT the clientId.')
param adminPrincipalId string

@allowed(['GP_S_Gen5', 'Basic'])
param sku string = 'GP_S_Gen5'

@allowed(['Enabled', 'Disabled'])
param publicNetworkAccess string = 'Enabled'

@description('Workstation IP allowed through the firewall. Empty = no rule.')
param clientIpAddress string = ''

@description('Minutes of inactivity before a serverless database pauses. Ignored for Basic.')
param autoPauseDelayMinutes int = 60

var isServerless = sku == 'GP_S_Gen5'

resource server 'Microsoft.Sql/servers@2021-11-01' = {
  name: serverName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: publicNetworkAccess
    administrators: {
      administratorType: 'ActiveDirectory'
      azureADOnlyAuthentication: true
      principalType: 'Application'
      login: adminLogin
      sid: adminPrincipalId
      tenantId: tenant().tenantId
    }
  }
}

resource database 'Microsoft.Sql/servers/databases@2021-11-01' = {
  parent: server
  name: databaseName
  location: location
  tags: tags
  sku: isServerless
    ? {
        name: 'GP_S_Gen5'
        tier: 'GeneralPurpose'
        family: 'Gen5'
        capacity: 1
      }
    : {
        name: 'Basic'
        tier: 'Basic'
        capacity: 5
      }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: isServerless ? 34359738368 : 2147483648
    zoneRedundant: false
    requestedBackupStorageRedundancy: 'Local'
    autoPauseDelay: isServerless ? autoPauseDelayMinutes : null
    minCapacity: isServerless ? json('0.5') : null
  }
}

// Lets Azure-hosted services (App Service outbound, GitHub-hosted runners are NOT included) reach the server.
resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2021-11-01' = if (publicNetworkAccess == 'Enabled') {
  parent: server
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource allowClientIp 'Microsoft.Sql/servers/firewallRules@2021-11-01' = if (publicNetworkAccess == 'Enabled' && !empty(clientIpAddress)) {
  parent: server
  name: 'workstation'
  properties: {
    startIpAddress: clientIpAddress
    endIpAddress: clientIpAddress
  }
}

output serverName string = server.name
output serverFqdn string = server.properties.fullyQualifiedDomainName
output serverId string = server.id
output databaseName string = database.name
