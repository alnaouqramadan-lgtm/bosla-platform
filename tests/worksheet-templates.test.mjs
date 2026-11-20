import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath,pathToFileURL} from "node:url";

const modelPath=new URL("../src/lib/worksheet-model.ts",import.meta.url);
const modelUrl=pathToFileURL(fileURLToPath(modelPath)).href;
function evaluate(source){
  const script='import {worksheetData,approvedValue} from '+JSON.stringify(modelUrl)+';\n'+
    'const assert=(await import("node:assert/strict")).default;\n'+source;
  return execFileSync(process.execPath,["--experimental-strip-types","--input-type=module","-e",script],
    {encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}

test("export uses approved reviews, does not infer goal links or quantities",()=>{
  const out=evaluate([
    'const field=(content)=>({content,status:"approved"});',
    'const r3={stage:3,finalized_at:"2026-11-20",fields:{goals:field("هدف أ\\nهدف ب"),expected_results:field("أثر متوقع")}};',
    'const r4={stage:4,finalized_at:"2026-11-20",fields:{projects:field("مشروع 1\\nمشروع 2"),activities:field("نشاط 1\\nنشاط 2"),beneficiaries:field("أطفال\\nنساء"),timelines:field("الربع الأول\\nالربع الثاني"),estimated_costs:field("100\\n200")}};',
    'const r5={stage:5,finalized_at:"2026-11-20",fields:{kpis:field("عدد المستفيدين"),baselines:field("100"),targets:field("200"),verification:field("سجل")}};',
    'const data=worksheetData([r3,r4,r5]);',
    'assert.deepEqual(data.goals,["هدف أ","هدف ب"]);',
    'assert.equal(data.activities[0].project,"المشروع: مشروع 1 | النشاط: نشاط 1");',
    'assert.equal(data.activities[1].period,"الربع الثاني");',
    'assert.equal(data.activities[0].goal,"");',
    'assert.equal(data.activities[0].quantity,"");',
    'assert.equal(data.indicators[0].indicator,"عدد المستفيدين");',
    'assert.equal(data.indicators[0].frequency,"");',
    'assert.equal(data.expectedResults,"أثر متوقع");',
    'console.log("ok");'
  ].join("\n"));
  assert.equal(out,"ok");
});

test("draft and unapproved workshop results cannot leak into final forms",()=>{
  const out=evaluate([
    'const r={stage:4,finalized_at:null,fields:{activities:{content:"مسودة سرية"}}};',
    'assert.equal(approvedValue([r],4,"activities"),"");',
    'const data=worksheetData([r]);',
    'assert.equal(data.activities[0].project,"");',
    'assert.equal(data.stageFourApproved,false);',
    'assert.ok(data.activities.length>=5);',
    'console.log("ok");'
  ].join("\n"));
  assert.equal(out,"ok");
});
