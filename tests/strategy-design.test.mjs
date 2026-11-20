import test from "node:test";
import assert from "node:assert/strict";
import {readDesign,workshopAgenda,weightedScore} from "../src/lib/strategy-design.ts";
test("older plans open with an empty evidence register and separate workshop routes",()=>{
 assert.deepEqual(readDesign({}).factors,[]);
 assert.notDeepEqual(workshopAgenda("تحديث استراتيجية قائمة"),workshopAgenda("بناء استراتيجية جديدة"));
});
test("sensitivity can reverse the preferred option and zero total weight has no score",()=>{
 const a=[5,1,3,3],b=[1,5,3,3];
 assert.ok(weightedScore(a,[75,25,0,0])>weightedScore(b,[75,25,0,0]));
 assert.ok(weightedScore(a,[25,75,0,0])<weightedScore(b,[25,75,0,0]));
 assert.equal(weightedScore(a,[0,0,0,0]),null);
});
test("invalid decision data cannot silently overwrite existing records",()=>{
 assert.throws(()=>readDesign({...readDesign({}),options:[{}]}));
});
test("workshop design adapts preparation and preserves every available minute",async()=>{
 const {prepareWorkshop}=await import("../src/lib/strategy-design.ts");
 for(const route of ["بناء استراتيجية جديدة","تحديث استراتيجية قائمة"]){
  for(const minutes of [4,7,61,135,480,10080]){
   const {sessions}=prepareWorkshop(route,"تعليمي",minutes);
   assert.equal(sessions.reduce((total,s)=>total+s.minutes,0),minutes);
   assert.ok(sessions.every(s=>s.minutes>=1&&s.output));
  }
 }
 const legacy=readDesign({route:"تحديث استراتيجية قائمة",sector:"قطاع آخر",duration:"يومان",factors:[]});
 assert.ok(prepareWorkshop(legacy.route,legacy.sector).sessions.every(s=>s.minutes===null));
 assert.notEqual(prepareWorkshop(legacy.route,"صحي").sectorQuestion,prepareWorkshop(legacy.route,"تجاري").sectorQuestion);
 assert.throws(()=>readDesign({...legacy,workshopMinutes:-2}));
});
