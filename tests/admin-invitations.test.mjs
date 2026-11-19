import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load = path => readFileSync(new URL(path, import.meta.url),'utf8');
const original = load('../supabase/migrations/20261119231606_admin_only_membership_whatsapp_share.sql');
const hardened = load('../supabase/migrations/20261119232059_move_admin_definers_to_private_schema.sql');
const workshop = load('../src/app/workshops/[id]/page.tsx');
const dashboard = load('../src/app/dashboard/page.tsx');

test('admin-only membership is enforced by server-side authorization',()=>{
 assert.match(original,/private\.planning_platform_admins/);
 assert.match(original,/not private\.planning_is_platform_admin\(\)/);
 assert.match(original,/create or replace function public\.planning_join_by_code/);
 assert.match(original,/الانضمام برمز عام موقوف/);
 assert.match(hardened,/create or replace function private\.planning_admin_add_participant_checked/);
 assert.match(hardened,/create or replace function public\.planning_admin_add_participant/);
 assert.match(hardened,/security invoker/);
});
test('WhatsApp invitation is manual and uses existing user accounts',()=>{
 assert.match(workshop,/planning_admin_add_participant/);
 assert.match(workshop,/platformAdmin&&/);
 assert.match(workshop,/https:\/\/wa\.me\//);
 assert.match(workshop,/اضغط إرسال؛ الرسالة لا تُرسل تلقائيًا/);
 assert.doesNotMatch(dashboard,/supabase\.rpc\("planning_join_by_code"/);
});