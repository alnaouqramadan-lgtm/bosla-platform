import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load = p => readFileSync(new URL(p, import.meta.url),'utf8');
const stages = load('../src/lib/stages.ts');
const schema = load('../supabase/migrations/20261119201304_bosla_standalone_planning_phase1.sql');
const workshop = load('../src/app/workshops/[id]/page.tsx');

test('exactly five planning stages and 28 empty input fields',()=>{
  assert.equal((stages.match(/description: "/g)||[]).length,5);
  assert.equal((stages.match(/\{key:/g)||[]).length,28);
});
test('standalone migration has no dependency on ENJAZ profiles/organizations',()=>{
  assert.match(schema,/create table public\.planning_organizations/);
  assert.match(schema,/create table public\.planning_profiles/);
  assert.doesNotMatch(schema,/references public\.(organizations|profiles|activities|projects)\b/);
});
test('all eight standalone exposed planning tables have RLS enabled',()=>{
  for(const table of ['planning_profiles','planning_organizations','planning_workshops',
    'planning_groups','planning_participants','planning_answers','planning_priorities','planning_votes']) {
    assert.match(schema,new RegExp(`alter table public\\.${table} enable row level security;`));
  }
});
test('autosave, voting, stage closing, workbook export and preservation are present',()=>{
  for(const term of ['saveStatus','setTimeout','vote_open','open_stages','collectPriorities','exportWorkbook']){
    assert.ok(workshop.includes(term),`Missing: ${term}`);
  }
  assert.ok(load('../src/lib/export.ts').includes('groupRepeated'));
});
