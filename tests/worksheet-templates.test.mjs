import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(name)=>readFileSync(new URL(name,import.meta.url),"utf8");
const model=read("../src/lib/worksheet-model.ts");
const pdf=read("../src/components/WorksheetPrint.tsx");
const excel=read("../src/lib/export.ts");
const page=read("../src/app/workshops/[id]/page.tsx");
const css=read("../src/app/globals.css");

test("three RTL workshop templates exist for both exports",()=>{
 for(const heading of ["أين نحن الآن؟","ما الذي يساعدنا وما الذي يعيقنا؟","ماذا نريد أن نحقق"]){
  assert.ok(pdf.includes(heading),heading);
  assert.ok(excel.includes(heading),heading);
 }
 for(const label of ["الموارد البشرية الحالية","نطاق العمل والمواقع","الفئات المستهدفة",
 "نقاط القوة","نقاط الضعف","الفرص","التهديدات","مؤشرات النجاح العامة"]){
  assert.ok(pdf.includes(label),label);
 }
 assert.match(css,/@page\s*\{\s*size:A4 landscape;/);
 assert.match(css,/\.bosla-worksheet-print\s*\{\s*display:none;/);
 assert.match(page,/حفظ PDF \/ طباعة النماذج/);
});
test("group exports are isolated and original answer sheets remain intact",()=>{
 assert.match(model,/a\.scope!=="group"/);
 assert.match(model,/a\.owner_id!==g\.id/);
 assert.match(excel,/worksheetGroups\(workshop,answers,groups,participants,organizationName\)/);
 assert.match(excel,/"الإجابات الأصلية"/);
 assert.match(excel,/"النماذج المعتمدة"/);
 assert.match(excel,/"الأولويات والتصويت"/);
});
