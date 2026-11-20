import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath,pathToFileURL} from "node:url";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../supabase/migrations/20261120101954_bosla_institutional_planning_foundation_v1.sql");
const home=read("../src/app/plans/page.tsx");
const detail=read("../src/app/plans/[id]/page.tsx");
const dashboard=read("../src/app/dashboard/page.tsx");
const helpers=pathToFileURL(fileURLToPath(new URL("../src/lib/institutional-planning.ts",import.meta.url))).href;
function run(src){
 return execFileSync(process.execPath,["--experimental-strip-types","--input-type=module","-e",
  'import {optionalNumber,optionalNonnegative,splitApprovedGoals,validatePlanPeriod} from '+JSON.stringify(helpers)+';\n'+
  'import assert from "node:assert/strict";\n'+src],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}
test("strategy/operations models validate dates, numbers and approved workshop goals",()=>{
 const src=[
  'assert.equal(optionalNumber(""),null);',
  'assert.equal(optionalNonnegative(""),null);',
  'assert.equal(optionalNonnegative("250.50"),250.5);',
  'assert.throws(()=>optionalNonnegative("-1"));',
  'assert.throws(()=>optionalNumber("hello"));',
  'assert.throws(()=>validatePlanPeriod("2029-01-01","2028-12-31"));',
  'assert.doesNotThrow(()=>validatePlanPeriod("2027-01-01","2029-12-31"));',
  'assert.deepEqual(splitApprovedGoals("هدف أ\\n هدف ب \\nهدف أ\\n"),["هدف أ","هدف ب"]);',
  'console.log("ok");'
 ].join("\n");
 assert.equal(run(src),"ok");
});
test("tenant-scoped relational model includes cross-plan protections and RLS",()=>{
 for(const table of ["planning_strategic_plans","planning_strategic_goals",
  "planning_operational_activities","planning_performance_indicators"]){
  assert.ok(sql.includes("create table if not exists public."+table),table);
  assert.ok(sql.includes("alter table public."+table+" enable row level security"),table);
 }
 assert.match(sql,/foreign key\(goal_id,plan_id,organization_id\)/);
 assert.match(sql,/private\.planning_owner\(organization_id\)/);
 assert.match(sql,/on delete restrict/);
 assert.match(sql,/status='draft'/);
 assert.match(sql,/created_by=\(select auth.uid\(\)\)/);
 assert.doesNotMatch(sql,/service_role|policy\s+\w+\s+on\s+.*\s+to\s+anon/i);
});
test("institutional screens can create plans, goals, linked activities and KPIs",()=>{
 for(const marker of ["planning_strategic_plans","source_workshop_id","إنشاء مسودة الخطة"]){
  assert.ok(home.includes(marker),marker);
 }
 for(const marker of ["planning_strategic_goals","planning_operational_activities",
  "planning_performance_indicators","goal_id","استيراد الأهداف المعتمدة من ورشة المصدر",
  "finalized_at","status!=\"approved\""]){
  // The finalized workshop import must remain an explicit, separate action.
  if(marker==="status!=\"approved\"")continue;
  assert.ok(detail.includes(marker),marker);
 }
 assert.match(detail,/fields\?\.goals\?\.status!=="approved"/);
 assert.ok(dashboard.includes('href="/plans"'));
 assert.match(detail,/لا تجمع بوصلة عملات مختلفة في إجمالي واحد/);
});
test("approval and monitoring must remain separate from unapproved drafts",()=>{
 assert.match(sql,/check \(status='draft'\)/);
 assert.match(detail,/مسودة غير معتمدة/);
 assert.match(detail,/active==="governance"&&<PlanGovernance/);
 assert.match(detail,/const canEdit=plan\?\.status==="draft"/);
});

test("editing and cancellation are supported for all planning record types",()=>{
 for(const marker of ["editingGoalId","editingActivityId","editingKpiId",
  "beginGoalEdit","beginActivityEdit","beginKpiEdit",
  "حفظ تعديل الهدف","حفظ تعديل النشاط","حفظ تعديل المؤشر",
  "إلغاء التعديل"]){
  assert.ok(detail.includes(marker),"missing "+marker);
 }
 assert.match(detail,/\.update\(data\)/);
 assert.match(detail,/\.eq\("plan_id",id\)/);
});

test("only finalized source workshop analysis can be imported as draft SWOT",()=>{
 assert.match(detail,/importApprovedSwot/);
 assert.match(detail,/eq\("stage",2\)/);
 assert.match(detail,/ورقة تحليل SWOT \(2\) لم تُعتمد نهائيًا/);
 assert.match(detail,/item\.status!=="approved"/);
 assert.match(detail,/environmental_analysis:analysis/);
 assert.match(detail,/importApprovedGoals/);
 assert.match(detail,/splitApprovedGoals/);
});
