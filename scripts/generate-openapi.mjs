#!/usr/bin/env node
// Writes infra/openapi.json from the built API. Needs the .NET SDK on the host (`npm run setup`).
//
//   node scripts/generate-openapi.mjs
//
// The document is committed. The backend contract suite fails when the running API no longer matches
// it (OpenApiContractTests), so an API change cannot land without showing up in the diff — and the
// generated frontend types and the MSW handlers stay anchored to something real.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = 'src/GameShelf.Api';
const assembly = `${project}/bin/Debug/net8.0/GameShelf.Api.dll`;

const run = (args, env = {}) => {
  const result = spawnSync('dotnet', args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(['build', project, '-c', 'Debug', '-v', 'q', '--nologo']);

// Placeholders only: the CLI builds the host to read its Swagger document. It never opens a
// database connection and, with auth disabled, never looks for an issuer.
run(['swagger', 'tofile', '--output', 'infra/openapi.json', assembly, 'v1'], {
  ASPNETCORE_ENVIRONMENT: 'Development',
  ConnectionStrings__GameShelf: 'Server=placeholder;Database=placeholder;Trusted_Connection=False',
  Database__MigrateOnStartup: 'false',
  Auth__Enabled: 'false',
});

console.log('Wrote infra/openapi.json');
