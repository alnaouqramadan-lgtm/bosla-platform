import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const schema=readFileSync(new URL('../supabase/migrations/20261119201304_bosla_standalone_planning_phase1.sql',import.meta.url),'utf8');
const hardened=readFileSync(new URL('../supabase/migrations/20261119201523_bosla_phase1_indexes_identity_guard.sql',import.meta.url),'utf8');
const all=schema+'\n'+hardened;
const tables=['profiles','organizations','workshops','groups','participants','answers','priorities','votes'];
test('eight BOSLA tables use RLS and authenticated-specific policies',()=>{
  for(const t of tables){
    assert.match(schema,new RegExp('alter table public\\.planning_'+t+' enable row level security;'));
  }
  assert.doesNotMatch(schema,/create policy [^\n]+ to anon/i);
});
test('all exports and private functions are independent of ENJAZ data',()=>{
  assert.doesNotMatch(all,/nlfpktiyjxuamlllbejc|references public\.(?:organizations|profiles|activities|projects)\b/i);
  assert.match(schema,/create schema if not exists private;/);
  assert.match(schema,/security definer set search_path = ''/);
});
test('optimizations provide indexes and prevent moving row IDs',()=>{
  assert.ok((hardened.match(/create index if not exists/g)||[]).length>=15);
  assert.match(hardened,/new.id is distinct from old.id/);
});
