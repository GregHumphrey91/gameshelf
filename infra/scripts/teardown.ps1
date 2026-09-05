<#
.SYNOPSIS
  Deletes the whole environment. Run this at the end of every working session.

.DESCRIPTION
  Everything in the resource group is recreated by bootstrap.ps1 / the deploy workflow, so
  deleting it between sessions costs a few minutes of redeploy time and saves the hourly
  charges for the App Service Plan, SQL database and (in Phase 6) private endpoints.

  The only thing you lose is data in the database — which, for a practice environment, is fine.
#>
[CmdletBinding()]
param(
  [string]$EnvironmentName = 'dev',
  [string]$ResourceGroup = "rg-gameshelf-$EnvironmentName-wus2"
)

$ErrorActionPreference = 'Stop'

Write-Host "Deleting $ResourceGroup (async)..."
az group delete --name $ResourceGroup --yes --no-wait
Write-Host "Requested. Check progress with: az group show --name $ResourceGroup"
