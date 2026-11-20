import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath,pathToFileURL} from "node:url";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const exported=read("../src/lib/export.ts");
const printed=read("../src/components/WorksheetPrint.tsx");
const model=read("../src/lib/worksheet-details.ts");

test("all five worksheets render for every group in PDF and Excel",()=>{
  assert.match(printed,/<Reality g=\{g\}\/><Swot g=\{g\}\/><Goals g=\{g\}\/><Execution g=\{g\}\/><Performance g=\{g\}\/>/);
  for(let n=1;n<=5;n++)assert.ok(exported.includes("make("+n+","),"Excel missing sheet "+n);
  assert.match(exported,/worksheetGroups\(workshop,answers,groups,participants,organizationName\)/);
  assert.match(exported,/"الإجابات الأصلية"/);
  assert.match(exported,/"النماذج المعتمدة"/);
  assert.match(printed,/worksheetDataNote/);
});

test("activity and KPI rows keep source data without inventing objectives or measurements",()=>{
  // Node 22's built-in type stripping runs the mapper without any dependencies.
  const url=pathToFileURL(fileURLToPath(new URL("../src/lib/worksheet-details.ts",import.meta.url))).href;
  const program=[
    'import assert from "node:assert/strict";',
    'import {executionRows,performanceRows,goalsForGroup} from '+JSON.stringify(url)+';',
    'const g={values:{"3:goals":"هدف أ\\nهدف ب",',
    '"4:activities":"نشاط 1\\nنشاط 2\\nنشاط 3\\nنشاط 4\\nنشاط 5\\nنشاط 6",',
    '"4:beneficiaries":"الأطفال\\nالطلبة","4:estimated_costs":"100\\n200",',
    '"5:kpis":"مؤشر أ\\nمؤشر ب","5:baselines":"10\\n20",',
    '"5:targets":"30\\n40","5:verification":"سجلات\\nتقرير"}};',
    'const a=executionRows(g), k=performanceRows(g);',
    'assert.equal(a.length,6);',
    'assert.equal(a[5].activity,"نشاط: نشاط 6");',
    'assert.equal(a[0].audience,"الأطفال");',
    'assert.equal(a[0].cost,"100");',
    'assert.equal(a[0].goal,"");assert.equal(a[0].quantity,"");',
    'assert.equal(k[0].kpi,"مؤشر أ");',
    'assert.equal(k[0].baseline,"10");',
    'assert.equal(k[0].target,"30");',
    'assert.equal(k[0].frequency,"");assert.equal(k[0].goal,"");',
    'assert.deepEqual(goalsForGroup(g),["هدف أ","هدف ب"]);'
  ].join("\n");
  execFileSync(process.execPath,["--experimental-strip-types","--input-type=module","-e",program],{
    encoding:"utf8",stdio:["ignore","pipe","pipe"]
  });
});
test("source fields remain group-scoped and no workflow database change is needed",()=>{
  assert.match(model,/g\.values\[stage\+"\:"\+key\]/);
  assert.doesNotMatch(model,/supabase|INSERT|UPDATE/i);
  assert.match(exported,/book\.definedNames\.add/);
  assert.match(exported,/dataValidation=\{type:"list"/);
});
