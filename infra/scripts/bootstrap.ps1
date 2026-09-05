<#
.SYNOPSIS
  One-time (per environment) setup that Bicep deliberately does not own.

.DESCRIPTION
  1. Creates the resource group.
  2. Deploys infra/bicep/main.bicep.
  3. Grants the role assignments the deploy identity cannot grant itself:
       - deploy identity  -> Contributor on the resource group
       - runtime identity -> AcrPull on the registry
  Role assignments live here, not in Bicep, so the pipeline (Contributor only) can
  re-run the template without needing permission to hand out roles.

  Run this as a subscription Owner from a shell where `az login` has been done.

.EXAMPLE
  ./infra/scripts/bootstrap.ps1 -GithubRepository "<owner>/gameshelf"
#>
[CmdletBinding()]
param(
  [string]$EnvironmentName = 'dev',
  [string]$Location = 'westus2',
  [string]$ResourceGroup = "rg-gameshelf-$EnvironmentName-wus2",
  [string]$GithubRepository = '',
  [string]$ClientIpAddress = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..' '..')
$paramFile = Join-Path $repoRoot "infra/bicep/env/$EnvironmentName.bicepparam"

if (-not $ClientIpAddress) {
  $ClientIpAddress = (Invoke-RestMethod -Uri 'https://api.ipify.org').Trim()
}

Write-Host "==> Resource group $ResourceGroup ($Location)"
az group create --name $ResourceGroup --location $Location --output none

Write-Host "==> Deploying Bicep"
$deployment = az deployment group create `
  --resource-group $ResourceGroup `
  --name "bootstrap-$(Get-Date -Format yyyyMMddHHmmss)" `
  --parameters $paramFile `
  --parameters clientIpAddress=$ClientIpAddress githubRepository=$GithubRepository `
  --query 'properties.outputs' --output json | ConvertFrom-Json

$deployPrincipalId  = $deployment.deployIdentityPrincipalId.value
$runtimePrincipalId = $deployment.runtimeIdentityPrincipalId.value
$acrName            = $deployment.acrName.value
$rgId               = az group show --name $ResourceGroup --query id --output tsv
$acrId              = az acr show --name $acrName --query id --output tsv

Write-Host "==> Role assignments"
az role assignment create --assignee-object-id $deployPrincipalId --assignee-principal-type ServicePrincipal `
  --role Contributor --scope $rgId --output none
az role assignment create --assignee-object-id $runtimePrincipalId --assignee-principal-type ServicePrincipal `
  --role AcrPull --scope $acrId --output none

Write-Host ""
Write-Host "Done. Values for the GitHub 'dev' environment (variables, not secrets):"
Write-Host "  AZURE_CLIENT_ID       = $($deployment.deployIdentityClientId.value)"
Write-Host "  AZURE_TENANT_ID       = $(az account show --query tenantId --output tsv)"
Write-Host "  AZURE_SUBSCRIPTION_ID = $(az account show --query id --output tsv)"
Write-Host "  AZURE_RESOURCE_GROUP  = $ResourceGroup"
Write-Host "  ACR_NAME              = $acrName"
Write-Host ""
Write-Host "API: $($deployment.apiUrl.value)"
Write-Host "Web: $($deployment.webUrl.value)"
