// Two user-assigned managed identities with clearly separated jobs:
//   deploy  — what GitHub Actions becomes via OIDC. Contributor on the resource group (granted by bootstrap.ps1).
//             Also the SQL server's Entra admin so the pipeline can run migrations and create DB users.
//   runtime — what the App Services run as. AcrPull on the registry (bootstrap.ps1) and a
//             database user created by the migration step. Never has control-plane rights.

param location string
param tags object
param deployIdentityName string
param runtimeIdentityName string

@description('GitHub repository (owner/name). Empty skips the federated credential.')
param githubRepository string = ''

@description('GitHub Environment name used in the OIDC subject claim.')
param githubEnvironment string = 'dev'

resource deployIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: deployIdentityName
  location: location
  tags: tags
}

// The subject must match the token GitHub issues *exactly*:
//   repo:<owner>/<repo>:environment:<environment>
// A job that does not declare `environment:` gets a different subject (repo:...:ref:refs/heads/main)
// and will fail with AADSTS70021. Add a second credential if you need both.
resource githubFederatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = if (!empty(githubRepository)) {
  parent: deployIdentity
  name: 'github-${replace(githubRepository, '/', '-')}-${githubEnvironment}'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepository}:environment:${githubEnvironment}'
    audiences: ['api://AzureADTokenExchange']
  }
}

resource runtimeIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: runtimeIdentityName
  location: location
  tags: tags
}

output deployIdentityName string = deployIdentity.name
output deployIdentityId string = deployIdentity.id
output deployClientId string = deployIdentity.properties.clientId
output deployPrincipalId string = deployIdentity.properties.principalId

output runtimeIdentityName string = runtimeIdentity.name
output runtimeIdentityId string = runtimeIdentity.id
output runtimeClientId string = runtimeIdentity.properties.clientId
output runtimePrincipalId string = runtimeIdentity.properties.principalId
