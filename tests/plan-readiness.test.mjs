import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath,pathToFileURL} from "node:url";

const src=pathToFileURL(fileURLToPath(new URL("../src/lib/plan-readiness.ts",import.meta.url))).href;
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
function run(code){
 return execFileSync(process.execPath,["--experimental-strip-types","--input-type=module","-e",
  'import {assessPlanReadiness} from '+JSON.stringify(src)+';\n'+
  'import assert from "node:assert/strict";\n'+code
 ],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}
test("mandatory publication checks match backend without falsely treating missing targets as zero",()=>{
 assert.equal(run([
  'const plan={vision:"رؤية واضحة",mission:"رسالة واضحة",institutional_values:"",environmental_analysis:"",period_start:"2027-01-01",period_end:"2029-12-31"};',
  'const goals=[{id:"g",title:"هدف",strategic_axis:"",description:""}];',
  'const activities=[{id:"a",title:"تنفيذ",owner_name:"",planned_start:null,planned_end:null,estimated_budget:null,target_quantity:null,target_unit:"",risk_notes:""}];',
  'const indicators=[{id:"k",target:null,baseline:null,verification_source:"",methodology:""}];',
  'const a=assessPlanReadiness({plan,goals,activities,indicators});',
  'assert.equal(a.mandatoryTotal,7);',
  'assert.equal(a.mandatoryMissing,2);',
  'assert.equal(a.canPublish,false);',
  'assert.equal(a.checks.find(x=>x.id==="targets").passed,false);',
  'assert.equal(a.checks.find(x=>x.id==="verification").passed,false);',
  'assert.equal(a.recommendationsPassed,0);',
  'console.log("ok");'
 ].join("\n")),"ok");
});
test("complete required plan can be published even if advisory items need improvement",()=>{
 assert.equal(run([
  'const plan={vision:"رؤية واضحة",mission:"رسالة واضحة",institutional_values:"",environmental_analysis:"",period_start:"2027-01-01",period_end:"2029-12-31"};',
  'const goals=[{id:"g",title:"هدف",strategic_axis:"",description:""}];',
  'const activities=[{id:"a",owner_name:"",planned_start:null,planned_end:null,estimated_budget:null,target_quantity:null,target_unit:"",risk_notes:""}];',
  'const indicators=[{id:"k",target:0,baseline:null,verification_source:"  سجل تحقق  ",methodology:""}];',
  'const a=assessPlanReadiness({plan,goals,activities,indicators});',
  'assert.equal(a.canPublish,true);',
  'assert.equal(a.mandatoryMissing,0);',
  'assert.equal(a.checks.find(x=>x.id==="targets").passed,true);',
  'assert.ok(a.recommendationsPassed<a.recommendationsTotal);',
  'console.log("ok");'
 ].join("\n")),"ok");
});
test("recommendations catch schedules outside approved plan without blocking publication",()=>{
 assert.equal(run([
  'const plan={vision:"رؤية واضحة",mission:"رسالة واضحة",institutional_values:"قيم",environmental_analysis:"تحليل",period_start:"2027-01-01",period_end:"2029-12-31"};',
  'const goals=[{id:"g",strategic_axis:"محور",description:"نتيجة"}];',
  'const activities=[{id:"a",owner_name:"مشرف",planned_start:"2026-12-30",planned_end:"2027-02-01",estimated_budget:0,target_quantity:12,target_unit:"طفل",risk_notes:"مخاطر مقيمة"}];',
  'const indicators=[{id:"k",target:100,baseline:0,verification_source:"تقرير",methodology:"قسمة"}];',
  'const a=assessPlanReadiness({plan,goals,activities,indicators});',
  'assert.equal(a.canPublish,true);',
  'assert.equal(a.checks.find(x=>x.id==="schedule").passed,true);',
  'assert.equal(a.checks.find(x=>x.id==="schedule_in_period").passed,false);',
  'assert.equal(a.checks.find(x=>x.id==="budgets").passed,true);',
  'console.log("ok");'
 ].join("\n")),"ok");
});
test("readiness is advisory UI with navigation; KPI entry requires correct role",()=>{
 const panel=read("../src/components/PlanReadinessPanel.tsx");
 const governance=read("../src/components/PlanGovernance.tsx");
 const detail=read("../src/app/plans/[id]/page.tsx");
 assert.match(panel,/assessPlanReadiness/);
 assert.match(panel,/توصيات استكمال الخطة/);
 assert.match(panel,/ليس تقييمًا لجودة الخطة/);
 assert.match(panel,/onNavigate\(check.tab\)/);
 assert.match(governance,/PlanReadinessPanel/);
 assert.match(governance,/role==="owner"\|\|role==="editor"/);
 assert.match(governance,/event.preventDefault\(\);if\(busy\|\|!\(role==="owner"\|\|role==="editor"\)\|\|plan.status!=="approved"\)return;/);
 assert.match(governance,/getFullYear\(\)/);
 assert.match(detail,/onNavigate=\{setActive\}/);
});
test("goal coverage preserves goal order and reveals gaps hidden by plan totals",()=>{
 assert.equal(run(`
 const goals=[{id:"b"},{id:"a"},{id:"c"}];
 const activities=[{goal_id:"a"},{goal_id:"a"},{goal_id:"unknown"}];
 const indicators=[{goal_id:"a"},{goal_id:"b"}];
 const plan={vision:"vision",mission:"mission"};
 const result=assessPlanReadiness({goals,activities,indicators,plan});
 assert.deepEqual(result.goalCoverage.map(r=>[r.goal.id,r.activityCount,r.indicatorCount]),
   [["b",0,1],["a",2,1],["c",0,0]]);
 assert.deepEqual(assessPlanReadiness({goals:[],activities,indicators,plan}).goalCoverage,[]);
 console.log("ok");
 `),"ok");
});
