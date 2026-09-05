// Azure Container Registry.
// Basic tier is enough for Phases 3-5. Admin user stays off: images are pushed by the deploy
// identity (`az acr build`) and pulled by the runtime identity (AcrPull) — no registry passwords.
//
// Phase 6 note: a private endpoint on ACR requires the Premium tier, which costs far more than
// everything else in this environment combined. Privatising SQL alone is a reasonable stopping point.

param location string
param tags object

@minLength(5)
@maxLength(50)
param name string

@allowed(['Basic', 'Standard', 'Premium'])
param sku string = 'Basic'

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: false
  }
}

output id string = registry.id
output name string = registry.name
output loginServer string = registry.properties.loginServer
