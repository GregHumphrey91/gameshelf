// PHASE 6 — not referenced from main.bicep yet.
//
// VNet with three subnets:
//   snet-appsvc    App Service regional VNet integration (outbound traffic enters the VNet here)
//   snet-pe        private endpoints for SQL (and optionally ACR)
//   snet-migration ephemeral Azure Container Instance that runs EF Core migrations
// plus the private DNS zones that make the *same* hostnames resolve to private IPs from inside the VNet.
//
// Before first use: az provider register --namespace Microsoft.ContainerInstance --wait

param location string
param tags object
param vnetName string
param addressPrefix string = '10.60.0.0/22'
param appServiceSubnetPrefix string = '10.60.0.0/23'
param privateEndpointSubnetPrefix string = '10.60.2.0/24'
param migrationSubnetPrefix string = '10.60.3.0/28'

resource appServiceNsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: 'nsg-${vnetName}-appsvc'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'deny-inbound-internet'
        properties: {
          priority: 4000
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource privateEndpointNsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: 'nsg-${vnetName}-pe'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'deny-inbound-internet'
        properties: {
          priority: 4000
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [addressPrefix]
    }
    subnets: [
      {
        name: 'snet-appsvc'
        properties: {
          addressPrefix: appServiceSubnetPrefix
          networkSecurityGroup: { id: appServiceNsg.id }
          delegations: [
            {
              name: 'appservice'
              properties: { serviceName: 'Microsoft.Web/serverFarms' }
            }
          ]
        }
      }
      {
        name: 'snet-pe'
        properties: {
          addressPrefix: privateEndpointSubnetPrefix
          networkSecurityGroup: { id: privateEndpointNsg.id }
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
      {
        name: 'snet-migration'
        properties: {
          addressPrefix: migrationSubnetPrefix
          delegations: [
            {
              name: 'aci'
              properties: { serviceName: 'Microsoft.ContainerInstance/containerGroups' }
            }
          ]
        }
      }
    ]
  }
}

// Same hostname, different answer depending on where you ask from.
var privateDnsZoneNames = [
  'privatelink${environment().suffixes.sqlServerHostname}' // privatelink.database.windows.net
  'privatelink.azurecr.io'
]

resource privateDnsZones 'Microsoft.Network/privateDnsZones@2020-06-01' = [
  for zoneName in privateDnsZoneNames: {
    name: zoneName
    location: 'global'
    tags: tags
  }
]

resource privateDnsZoneLinks 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = [
  for (zoneName, i) in privateDnsZoneNames: {
    parent: privateDnsZones[i]
    name: '${vnetName}-link'
    location: 'global'
    tags: tags
    properties: {
      virtualNetwork: { id: vnet.id }
      registrationEnabled: false
    }
  }
]

output vnetId string = vnet.id
output appServiceSubnetId string = vnet.properties.subnets[0].id
output privateEndpointSubnetId string = vnet.properties.subnets[1].id
output migrationSubnetId string = vnet.properties.subnets[2].id
output sqlPrivateDnsZoneId string = privateDnsZones[0].id
output acrPrivateDnsZoneId string = privateDnsZones[1].id
