#!/usr/bin/env node
// BOSLA AI - read-only, dependency-free environment verification.
// Does not connect to Supabase or write to any source, database, or project.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ENJAZ_REF = 'nlfpktiyjxuamlllbejc';
const args = process.argv.slice(2);
const base = resolve(args[0] && !args[0].startsWith('--') ? args[0] : '.');
const expectIndex = args.indexOf('--project-ref');
const expected = expectIndex < 0 ? '' : (args[expectIndex + 1] || '').trim();
const failures = [];
const notices = [];
const file = join(base, '.env.local');
const vars = { ...process.env };
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const found = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!found) continue;
    let value = found[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    vars[found[1]] = value;
  }
} else notices.push('No .env.local file; checking process environment variables instead.');
const rawUrl = vars.NEXT_PUBLIC_SUPABASE_URL || '';
let ref = '';
try {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') failures.push('Supabase URL must use HTTPS.');
  const match = url.hostname.match(/^([a-z0-9]{15,30})\.supabase\.co$/i);
  if (!match) failures.push('Use the direct project URL (*.supabase.co), not a dashboard URL or placeholder.');
  else ref = match[1].toLowerCase();
} catch { failures.push('NEXT_PUBLIC_SUPABASE_URL is missing or invalid.'); }
if (ref === ENJAZ_REF) failures.push('BLOCKED: URL points to ENJAZ AI production, not BOSLA AI.');
if (expected && ref && ref !== expected.toLowerCase()) failures.push('The URL does not match the expected BOSLA project reference.');
if (expected && expected.toLowerCase() === ENJAZ_REF) failures.push('ENJAZ production reference cannot be a BOSLA target.');
const key = vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || vars.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
if (!key || /your-|placeholder|example/i.test(key)) failures.push('A valid public (publishable or anon) Supabase key is required.');
if (/^sb_secret_/i.test(key) || /service.role/i.test(key)) failures.push('BLOCKED: private Supabase key must never be used in NEXT_PUBLIC_ variables.');
if (!existsSync(join(base, 'package.json'))) failures.push('No package.json at selected application root.');
if (!existsSync(join(base, 'supabase', 'migrations'))) failures.push('No supabase/migrations directory found.');
console.log('BOSLA AI PRE-FLIGHT — READ ONLY');
console.log('Source folder:', base);
console.log('Supabase project ref:', ref || '(not determined)');
for (const n of notices) console.log('NOTE:', n);
for (const f of failures) console.error('FAIL:', f);
if (failures.length) { console.error(`Result: FAIL (${failures.length} issue(s)). No changes made.`); process.exitCode = 1; }
else console.log('Result: PASS (environment only). Database migration, RLS and deployment still require live tests.');
