import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath,pathToFileURL} from "node:url";

const url=pathToFileURL(fileURLToPath(new URL("../src/lib/worksheet-details.ts",import.meta.url))).href;
function run(js){
 return execFileSync(process.execPath,["--experimental-strip-types","--input-type=module","-e",
  'import {alignedLines,executionRows,performanceRows} from '+JSON.stringify(url)+';\n'+
  'import assert from "node:assert/strict";\n'+js
 ],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}
test("blank middle lines remain empty cells instead of shifting later activities",()=>{
 const js=[
  'const g={values:{"4:activities":"أ\\nب\\nج","4:beneficiaries":"أطفال\\n\\nنساء","4:responsibilities":"أحمد\\n\\nمحمد\\n","5:kpis":"مؤشر أ\\nمؤشر ب\\nمؤشر ج","5:baselines":"10\\n\\n30","5:targets":"20\\n\\n50"}};',
  'const a=executionRows(g),k=performanceRows(g);',
  'assert.equal(a[0].audience,"أطفال");',
  'assert.equal(a[1].audience,"");',
  'assert.equal(a[2].audience,"نساء");',
  'assert.equal(a[1].manager,"");',
  'assert.equal(a[2].manager,"محمد");',
  'assert.equal(k[0].baseline,"10");',
  'assert.equal(k[1].baseline,"");',
  'assert.equal(k[2].baseline,"30");',
  'assert.equal(k[1].target,"");',
  'assert.equal(k[2].target,"50");',
  'assert.deepEqual(alignedLines(g,4,"responsibilities"),["أحمد","","محمد"]);',
  'console.log("ok");'
 ].join("\n");
 assert.equal(run(js),"ok");
});
test("trailing blank lines do not add phantom rows",()=>{
 const js=[
  'const g={values:{"4:activities":"A\\nB\\n\\n\\n", "5:kpis":"K1\\nK2\\n\\n"}};',
  'assert.deepEqual(alignedLines(g,4,"activities"),["A","B"]);',
  'assert.deepEqual(alignedLines(g,5,"kpis"),["K1","K2"]);',
  'assert.equal(executionRows(g).length,5);',
  'console.log("ok");'
 ].join("\n");
 assert.equal(run(js),"ok");
});
test("entry form explains row alignment for both detailed worksheets",()=>{
 const form=readFileSync(new URL("../src/app/workshops/[id]/page.tsx",import.meta.url),"utf8");
 assert.match(form,/اترك سطرها فارغًا/);
 assert.match(form,/اكتب قيمة كل صف في سطر منفصل/);
});
