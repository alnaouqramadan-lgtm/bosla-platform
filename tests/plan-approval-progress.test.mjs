import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath,pathToFileURL} from "node:url";
const sql=readFileSync(new URL("../supabase/migrations/20261120133949_bosla_plan_approval_progress_v1.sql",import.meta.url),"utf8");
const plan=readFileSync(new URL("../src/app/plans/[id]/page.tsx",import.meta.url),"utf8");
const index=readFileSync(new URL("../src/app/plans/page.tsx",import.meta.url),"utf8");
const view=readFileSync(new URL("../src/components/PlanGovernance.tsx",import.meta.url),"utf8");
const team=readFileSync(new URL("../src/components/PlanTeamReview.tsx",import.meta.url),"utf8");
const src=pathToFileURL(fileURLToPath(new URL("../src/lib/progress-metrics.ts",import.meta.url))).href;
function run(code){
 return execFileSync(process.execPath,["--experimental-strip-types","--input-type=module","-e",
  'import {latestById,deliveryOverview} from '+JSON.stringify(src)+';\n'+
  'import assert from "node:assert/strict";\n'+code
 ],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}
test("a backdated correction cannot replace the latest delivery period",()=>{
 assert.equal(run([
  'const reports=[',
  ' {id:"a",activity_id:"A",report_date:"2026-11-19",created_at:"2026-11-19T10:00:00Z",progress_percent:80,delivery_status:"in_progress"},',
  ' {id:"b",activity_id:"A",report_date:"2026-11-15",created_at:"2026-11-20T15:00:00Z",progress_percent:30,delivery_status:"in_progress"}];',
  'const current=latestById(reports,r=>r.activity_id,r=>r.report_date);',
  'assert.equal(current.get("A").progress_percent,80);',
  'console.log("ok");'
 ].join("\n")),"ok");
});
test("completion and overdue counts do not claim to measure strategic impact",()=>{
 assert.equal(run([
  'const activities=[{id:"a",planned_end:"2026-11-01"},{id:"b",planned_end:"2026-11-30"},{id:"c",planned_end:"2026-11-01"}];',
  'const reports=[{id:"r1",activity_id:"a",report_date:"2026-11-01",created_at:"2026-11-01T10:00:00Z",progress_percent:100,delivery_status:"completed"}];',
  'const stats=deliveryOverview(activities,reports,"2026-11-20");',
  'assert.deepEqual(stats,{total:3,withReports:1,completed:1,overdue:1,unreported:2});',
  'console.log("ok");'
 ].join("\n")),"ok");
});
test("approved snapshot immutable from client, only tenant owner may read",()=>{
 assert.match(sql,/create table public\.planning_plan_revisions/);
 assert.match(sql,/snapshot jsonb not null/);
 assert.match(sql,/revoke all on public\.planning_plan_revisions from public,anon,authenticated/);
 assert.match(sql,/grant select on public\.planning_plan_revisions to authenticated/);
 assert.match(sql,/planning_plan_revisions_owner_read/);
 assert.match(sql,/private\.planning_owner\(organization_id\)/);
 assert.match(sql,/create function private\.planning_publish_plan/);
 assert.match(sql,/security definer/);
 assert.match(sql,/revoke all on function private\.planning_publish_plan\(uuid\) from public,anon/);
 assert.match(sql,/create function public\.planning_publish_plan/);
 assert.match(sql,/language sql security invoker/);
 assert.match(sql,/if p\.status<>'draft'/);
 assert.match(sql,/not private\.planning_owner\(p\.organization_id\)/);
 assert.match(sql,/insert into public\.planning_plan_revisions/);
 assert.match(sql,/status='approved'/);
 assert.match(sql,/k\.target is null/);
 assert.match(sql,/length\(btrim\(k\.verification_source\)\)=0/);
});
test("progress and KPI evidence is append-only and locked to approved same-tenant plan",()=>{
 for(const table of ["planning_activity_progress","planning_kpi_measurements"]){
  assert.match(sql,new RegExp("create table public\\."+table));
  assert.match(sql,new RegExp("alter table public\\."+table+" enable row level security"));
 }
 assert.match(sql,/foreign key\(activity_id,plan_id,organization_id\)/);
 assert.match(sql,/foreign key\(indicator_id,plan_id,organization_id\)/);
 assert.match(sql,/grant select,insert on public\.planning_activity_progress,public\.planning_kpi_measurements to authenticated/);
 assert.doesNotMatch(sql,/grant[^\n]*(update|delete) on public\.planning_activity_progress/i);
 assert.doesNotMatch(sql,/grant[^\n]*(update|delete) on public\.planning_kpi_measurements/i);
 assert.match(sql,/and reported_by=\(select auth\.uid\(\)\)/);
 assert.match(sql,/and measured_by=\(select auth\.uid\(\)\)/);
 assert.match(sql,/and p\.status='approved'/);
 assert.match(sql,/progress_percent between 0 and 100/);
 assert.match(sql,/check \(delivery_status<>'completed' or progress_percent=100\)/);
});
test("published plan editor is read-only and exposes monitoring",()=>{
 assert.match(plan,/canEdit&&<form/);
 assert.match(plan,/canEdit\?<form/);
 assert.match(plan,/active==="governance"&&<PlanGovernance/);
 assert.match(plan,/const canEdit=plan\?\.status==="draft"/);
 assert.match(team,/planning_publish_plan/);
 assert.match(view,/planning_activity_progress/);
 assert.match(view,/planning_kpi_measurements/);
 assert.match(view,/آخر تقدم مسجل/);
 assert.match(view,/سجل تحديثات التنفيذ/);
 assert.match(view,/مصدر التحقق/);
 assert.match(index,/p\.status==="approved"/);
});
