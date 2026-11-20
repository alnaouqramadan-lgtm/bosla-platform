import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync(new URL("../supabase/migrations/20261120194500_bosla_institutional_readonly_members_v1.sql",import.meta.url),"utf8");
const members=readFileSync(new URL("../src/app/organizations/[id]/members/page.tsx",import.meta.url),"utf8");
const plans=readFileSync(new URL("../src/app/plans/page.tsx",import.meta.url),"utf8");
const detail=readFileSync(new URL("../src/app/plans/[id]/page.tsx",import.meta.url),"utf8");
const governance=readFileSync(new URL("../src/components/PlanGovernance.tsx",import.meta.url),"utf8");

test("membership table is tenant-bound, RLS protected, and never available to anonymous users",()=>{
 assert.match(sql,/create table public\.planning_organization_members/);
 assert.match(sql,/primary key\(organization_id,user_id\)/);
 assert.match(sql,/user_id uuid not null references auth\.users\(id\)/);
 assert.match(sql,/alter table public\.planning_organization_members enable row level security/);
 assert.match(sql,/revoke all on public\.planning_organization_members from public,anon,authenticated/);
 assert.match(sql,/private\.planning_owner\(organization_id\) and added_by=\(select auth\.uid\(\)\)/);
 assert.match(sql,/private\.planning_owner\(organization_id\) or user_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/status='active'/);
 assert.doesNotMatch(sql,/grant .* on public\.planning_organization_members to anon/);
});
test("members can see approved plans and evidence without any new write policies",()=>{
 for(const policy of [
  "planning_approved_plan_member_read",
  "planning_approved_goal_member_read",
  "planning_approved_activity_member_read",
  "planning_approved_kpi_member_read",
  "planning_approved_revision_member_read",
  "planning_approved_progress_member_read",
  "planning_approved_measurements_member_read"
 ])assert.match(sql,new RegExp("create policy "+policy));
 assert.match(sql,/using\(status='approved' and private\.planning_active_organization_member\(organization_id\)\)/);
 assert.match(sql,/m\.organization_id=p_organization and m\.user_id=\(select auth\.uid\(\)\) and m\.status='active'/);
 assert.match(sql,/p\.organization_id=planning_activity_progress\.organization_id and p\.status='approved'/);
 assert.match(sql,/p\.organization_id=planning_kpi_measurements\.organization_id and p\.status='approved'/);
 assert.doesNotMatch(sql,/planning_.*member_.* for (insert|update|delete) on public\.planning_strategic_/);
});
test("evidence insert policies correlate tenant and plan and do not use tautology",()=>{
 assert.match(sql,/p\.id=planning_activity_progress\.plan_id/);
 assert.match(sql,/p\.organization_id=planning_activity_progress\.organization_id/);
 assert.match(sql,/p\.id=planning_kpi_measurements\.plan_id/);
 assert.match(sql,/p\.organization_id=planning_kpi_measurements\.organization_id/);
 assert.doesNotMatch(sql,/p\.organization_id=p\.organization_id/);
});
test("member management is owner-only and cannot send unrequested messages",()=>{
 assert.match(members,/org\.data\.owner_id!==auth\.data\.user\.id/);
 assert.match(members,/planning_organization_members/);
 assert.match(members,/إيقاف الوصول/);
 assert.match(members,/حذف العضوية/);
 assert.match(members,/لا ترسل بريدًا أو واتساب تلقائيًا/);
 assert.match(plans,/\/organizations\/"\+o\.id\+"\/members/);
 assert.match(plans,/visibleOrgs\.find/);
 assert.match(plans,/معرف حسابي/);
});
test("board viewers cannot see mutating controls on approved plan",()=>{
 assert.match(detail,/setCanManage\(access\.data\?\.owner_id===auth\.data\.user\.id\)/);
 assert.match(detail,/!canManage\|\|plan\.status!=="draft"/);
 assert.match(detail,/onReload=\{load\} canManage=\{canManage\}/);
 assert.match(governance,/canManage:boolean/);
 assert.match(governance,/canManage&&<div className="institutional-followup-grid">/);
 assert.match(governance,/canManage&&<button className="primary"/);
 assert.match(governance,/!canManage\|\|plan\.status!=="approved"/);
});
