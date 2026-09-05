// One Linux App Service Plan shared by the API and web apps.
// B1 is the cheapest container-capable tier. Deployment slots need Standard (S1) or better.

param location string
param tags object
param name string

@allowed(['B1', 'B2', 'S1', 'P0v3', 'P1v3'])
param sku string = 'B1'

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: sku
  }
  properties: {
    reserved: true // required for Linux
    zoneRedundant: false
  }
}

output id string = plan.id
output name string = plan.name
