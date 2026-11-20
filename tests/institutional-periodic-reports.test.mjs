import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath,pathToFileURL} from "node:url";

const src=pathToFileURL(fileURLToPath(new URL("../src/lib/institutional-report.ts",import.meta.url))).href;
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
function run(code){
 return execFileSync(process.execPath,["--experimental-strip-types","--input-type=module","-e",
  'import {reportWindow,buildPeriodicReport} from '+JSON.stringify(src)+';\n'+
  'import assert from "node:assert/strict";\n'+code
 ],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}
test("reporting boundaries support months, quarters, year and leap February",()=>{
 assert.equal(run([
  'assert.equal(reportWindow("month",2028,2).end,"2028-02-29");',
  'assert.equal(reportWindow("month",2027,2).end,"2027-02-28");',
  'assert.equal(reportWindow("quarter",2026,4).start,"2026-10-01");',
  'assert.equal(reportWindow("quarter",2026,4).end,"2026-12-31");',
  'assert.equal(reportWindow("year",2026,9).start,"2026-01-01");',
  'assert.throws(()=>reportWindow("month",2026,13));',
  'assert.throws(()=>reportWindow("quarter",2026,0));',
  'console.log("ok");'
 ].join("\n")),"ok");
});
test("period report uses last dated cumulative evidence, not sum, and never fabricates zeros",()=>{
 assert.equal(run([
  'const plan={period_start:"2026-01-01",period_end:"2028-12-31"};',
  'const goals=[{id:"G",title:"تحسين الوصول"}];',
  'const a={goal_id:"G",owner_name:"المسؤول",target_quantity:100,target_unit:"طفل",status:"planned"};',
  'const activities=[',
  ' {id:"A",title:"نشاط قائم",planned_start:"2026-10-01",planned_end:"2026-11-05",estimated_budget:100,currency_code:"ILS",...a},',
  ' {id:"B",title:"مستقبلي",planned_start:"2026-12-10",planned_end:"2026-12-20",estimated_budget:200,currency_code:"ILS",...a},',
  ' {id:"C",title:"متأخر",planned_start:"2026-10-01",planned_end:"2026-10-15",estimated_budget:null,currency_code:"USD",...a}',
  '];',
  'const base={organization_id:"O",plan_id:"P",activity_id:"A",actual_quantity_to_date:10,delivery_status:"in_progress",summary:"",evidence_reference:"DOC-1"};',
  'const reports=[',
  ' {id:"before",...base,report_date:"2026-10-31",progress_percent:30,spent_to_date:10,created_at:"2026-11-01T10:00:00Z"},',
  ' {id:"new",...base,report_date:"2026-11-10",progress_percent:60,spent_to_date:35,created_at:"2026-11-11T09:00:00Z"},',
  ' {id:"retro",...base,report_date:"2026-10-31",progress_percent:15,spent_to_date:5,created_at:"2026-11-18T10:00:00Z"},',
  ' {id:"future",...base,report_date:"2026-11-21",progress_percent:100,spent_to_date:90,delivery_status:"completed",created_at:"2026-11-21T10:00:00Z"}',
  '];',
  'const indicator={goal_id:"G",unit:"%",verification_source:"source"};',
  'const indicators=[',
  ' {id:"K",title:"زيادة",baseline:0,target:100,...indicator},',
  ' {id:"D",title:"تخفيض",baseline:30,target:10,...indicator},',
  ' {id:"U",title:"اتجاه مجهول",baseline:null,target:5,...indicator},',
  ' {id:"N",title:"غير مقاس",baseline:0,target:5,...indicator}',
  '];',
  'const m=(id,date,actual,created)=>({id:id+date,indicator_id:id,measured_on:date,actual_value:actual,created_at:created||date+"T10:00:00Z",evidence_reference:"M1"});',
  'const measurements=[m("K","2026-10-31",50),m("K","2026-11-15",120),m("K","2026-11-25",130),m("D","2026-11-13",12),m("U","2026-11-12",5)];',
  'const x=buildPeriodicReport({plan,goals,activities,indicators,reports,measurements,period:"month",year:2026,slot:11,today:"2026-11-20"});',
  'assert.equal(x.asOf,"2026-11-20");',
  'assert.equal(x.activityLines[0].progress,60);',
  'assert.equal(x.activityLines[0].spent,35);',
  'assert.equal(x.activityLines[0].flag,"overdue");',
  'assert.equal(x.activityLines[1].flag,"scheduled");',
  'assert.equal(x.activityLines[1].spent,null);',
  'assert.equal(x.activityLines[2].flag,"overdue");',
  'assert.equal(x.totals.periodActivityUpdates,1);',
  'assert.equal(x.currencies.find(c=>c.currency==="ILS").planned,300);',
  'assert.equal(x.currencies.find(c=>c.currency==="ILS").spent,35);',
  'assert.equal(x.currencies.find(c=>c.currency==="ILS").variance,null);',
  'assert.equal(x.currencies.find(c=>c.currency==="USD").planned,null);',
  'assert.equal(x.indicatorLines[0].actual,120);',
  'assert.equal(x.indicatorLines[0].attainment,"met");',
  'assert.equal(x.indicatorLines[1].attainment,"not_met");',
  'assert.equal(x.indicatorLines[2].attainment,"unknown_direction");',
  'assert.equal(x.indicatorLines[3].attainment,"unmeasured");',
  'assert.equal(x.totals.periodKpiReadings,3);',
  'assert.equal(x.totals.met,1);',
  'assert.equal(x.totals.notMet,1);',
  'console.log("ok");'
 ].join("\n")),"ok");
});
test("future plan period does not claim delivery or count unexpected KPI results",()=>{
 assert.equal(run([
  'const x=buildPeriodicReport({plan:{period_start:"2027-01-01",period_end:"2029-12-31"},goals:[],',
  'activities:[{id:"A",goal_id:"G",title:"نشاط",owner_name:"",planned_start:"2027-02-01",planned_end:"2027-02-10",target_quantity:null,target_unit:"",estimated_budget:null,currency_code:"ILS"}],',
  'indicators:[],reports:[],measurements:[],period:"year",year:2027,slot:1,today:"2026-11-20"});',
  'assert.equal(x.hasStarted,false);',
  'assert.equal(x.activityLines[0].flag,"scheduled");',
  'assert.equal(x.activityLines[0].progress,null);',
  'console.log("ok");'
 ].join("\n")),"ok");
});
test("report page is RLS-bounded and refuses partial or unapproved report exports",()=>{
 const page=read("../src/app/plans/[id]/reports/page.tsx");
 const workbook=read("../src/lib/institutional-report-export.ts");
 const css=read("../src/app/globals.css");
 const plan=read("../src/app/plans/[id]/page.tsx");
 assert.match(page,/supabase\.auth\.getUser/);
 assert.match(page,/planning_strategic_plans/);
 assert.match(page,/status!=="approved"/);
 assert.match(page,/fetchAll<ActivityReport>/);
 assert.match(page,/fetchAll<KpiMeasurement>/);
 assert.match(page,/\.eq\("plan_id",planId\)/);
 assert.match(page,/\.range\(offset,offset\+batch-1\)/);
 assert.match(page,/لن يُصدر تقرير جزئي/);
 assert.match(page,/disabled=\{!ready\|\|exporting\}/);
 assert.match(page,/disabled=\{!ready\}/);
 assert.match(workbook,/ExcelJS/);
 assert.match(workbook,/FORMULA\.test\(text\)/);
 assert.match(workbook,/العملات|العملة/);
 assert.match(css,/\.wrap\.bosla-report-page > \.bosla-report-print/);
 assert.match(plan,/\/reports/);
 assert.doesNotMatch(page,/service_role|sb_secret_/i);
});
