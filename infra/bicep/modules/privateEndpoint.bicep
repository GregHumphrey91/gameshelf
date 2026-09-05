// PHASE 6 — not referenced from main.bicep yet.
//
// Reusable private endpoint: one instance per target resource.
//   SQL: groupId 'sqlServer', zone privatelink.database.windows.net
//   ACR: groupId 'registry',  zone privatelink.azurecr.io (Premium tier only)
// The DNS zone group writes the A record into the private zone so the public hostname
// resolves to the endpoint's private IP from inside the VNet.

param location string
param tags object
param name string
param subnetId string
param targetResourceId string
param groupId string
param privateDnsZoneId string

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    subnet: { id: subnetId }
    privateLinkServiceConnections: [
      {
        name: name
        properties: {
          privateLinkServiceId: targetResourceId
          groupIds: [groupId]
        }
      }
    ]
  }
}

resource dnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config'
        properties: { privateDnsZoneId: privateDnsZoneId }
      }
    ]
  }
}

output id string = privateEndpoint.id
output privateIpAddress string = privateEndpoint.properties.customDnsConfigs[0].ipAddresses[0]
