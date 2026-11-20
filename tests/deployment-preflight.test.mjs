import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = mkdtempSync(join(tmpdir(), 'bosla-preflight-'));
mkdirSync(join(fixture, 'supabase/migrations'), { recursive: true });
writeFileSync(join(fixture, 'package.json'), '{}');
after(() => rmSync(fixture, { recursive: true, force: true }));
const ref = 'madvrkqtducoivnaaldm';
function legacy(role, project = ref) {
  return ['header', Buffer.from(JSON.stringify({ role, ref: project })).toString('base64url'), 'signature'].join('.');
}
function check(key, overrides = {}) {
  return spawnSync(process.execPath, ['tools/preflight.mjs', fixture, '--project-ref', ref, '--vercel-only'], {
    cwd: root, encoding: 'utf8',
    env: { VERCEL: '1', NEXT_PUBLIC_SUPABASE_URL: 'https://' + ref + '.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: key, ...overrides }
  });
}
test('Vercel preflight accepts both supported public key formats', () => {
  assert.equal(check(legacy('anon')).status, 0);
  assert.equal(check('', { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ci' }).status, 0);
});
test('Vercel preflight rejects incorrect credentials without echoing values', () => {
  for (const key of [legacy('service_role'), legacy('anon', 'another-project'), 'sb_secret_ci', 'example']) {
    const result = check(key, { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ci' });
    assert.equal(result.status, 1);
    assert.ok(!(result.stdout + result.stderr).includes(key));
  }
});
test('Vercel preflight rejects missing keys and another project origin', () => {
  assert.equal(check('').status, 1);
  assert.equal(check('sb_publishable_ci', { NEXT_PUBLIC_SUPABASE_URL: 'https://another-project.supabase.co' }).status, 1);
});
