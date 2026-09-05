#!/usr/bin/env node
// Runs one or all test suites inside containers (docker-compose.test.yml) and always tears the stack down.
//
//   node scripts/docker-test.mjs <backend|frontend|e2e|all>
//
// For each suite:  docker compose -f docker-compose.test.yml --profile <suite> up --build
//                    --abort-on-container-exit --exit-code-from <runner>
// then:            docker compose -f docker-compose.test.yml down --volumes --remove-orphans
//
// Exit code is 0 only if every selected suite passed. Works from any shell (the root package.json calls it).

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SUITES = {
  backend: { profile: 'backend', runner: 'backend-tests' },
  frontend: { profile: 'frontend', runner: 'frontend-tests' },
  e2e: { profile: 'e2e', runner: 'e2e' },
};

const arg = process.argv[2] ?? 'all';
const selected = arg === 'all' ? Object.keys(SUITES) : [arg];
if (!selected.every((name) => SUITES[name])) {
  console.error(`Usage: node scripts/docker-test.mjs <${[...Object.keys(SUITES), 'all'].join('|')}>`);
  process.exit(2);
}

const compose = (...args) =>
  spawnSync('docker', ['compose', '-f', 'docker-compose.test.yml', ...args], { cwd: root, stdio: 'inherit' });

// `down` only touches services whose profiles are active, so activate all of them.
const allProfiles = Object.values(SUITES).flatMap(({ profile }) => ['--profile', profile]);
const teardown = () => compose(...allProfiles, 'down', '--volumes', '--remove-orphans');

// Ctrl+C reaches the docker child too; keep this process alive long enough to tear the stack down.
process.on('SIGINT', () => {});

const results = {};
for (const name of selected) {
  const { profile, runner } = SUITES[name];
  console.log(`\n==> ${name}: docker compose --profile ${profile} up --build --abort-on-container-exit --exit-code-from ${runner}\n`);
  const run = compose('--profile', profile, 'up', '--build', '--abort-on-container-exit', '--exit-code-from', runner);
  results[name] = run.status ?? 1;
  teardown();
}

console.log('\nSummary');
for (const [name, code] of Object.entries(results)) {
  console.log(`  ${code === 0 ? 'PASS' : 'FAIL'}  ${name}${code === 0 ? '' : ` (exit ${code})`}`);
}
process.exit(Object.values(results).some((code) => code !== 0) ? 1 : 0);
