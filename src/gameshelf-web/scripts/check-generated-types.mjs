#!/usr/bin/env node
// Fails when src/types/generated/api.ts is not what infra/openapi.json generates today.
//
// The types are committed so they can be read and reviewed; this is what keeps them honest. It
// regenerates into a temp directory and compares, rather than diffing the working tree, so it works
// the same in the test container (which has no git) as it does on a developer's machine.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = path.resolve(web, '../../infra/openapi.json');
const committed = path.resolve(web, 'src/types/generated/api.ts');

const require = createRequire(import.meta.url);
const pkgPath = require.resolve('openapi-typescript/package.json');
const cli = path.resolve(path.dirname(pkgPath), require(pkgPath).bin['openapi-typescript']);

const outDir = mkdtempSync(path.join(tmpdir(), 'gameshelf-types-'));
const fresh = path.join(outDir, 'api.ts');

try {
  const result = spawnSync(process.execPath, [cli, spec, '-o', fresh], {
    cwd: web,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (result.status !== 0) process.exit(result.status ?? 1);

  const normalize = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (normalize(fresh) !== normalize(committed)) {
    console.error(
      'src/types/generated/api.ts is out of date with infra/openapi.json — run `npm run generate:types` and commit the result.',
    );
    process.exit(1);
  }
  console.log('Generated types match infra/openapi.json');
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
