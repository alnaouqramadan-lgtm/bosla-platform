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
test("team comparison keeps the institutional rating and distinguishes one team from consensus",async()=>{
 const {withTeamRating,teamSpread}=await import("../src/lib/strategy-design.ts");
 const issue={id:"i",title:"قضية",factorIds:[],impact:2,urgency:3,confidence:4};
 const first={team:"فريق البرامج",impact:5,urgency:4,confidence:2,note:"محضر الورشة"};
 const one=withTeamRating(issue,first);
 assert.equal(teamSpread(one.teamRatings,"impact"),null);
 const two=withTeamRating(one,{...first,team:"فريق المالية",impact:2,confidence:5});
 assert.deepEqual(["impact","urgency","confidence"].map(axis=>teamSpread(two.teamRatings,axis)),[3,0,3]);
 const revised=withTeamRating(two,{...first,team:"  فريق   البرامج  ",impact:4});
 assert.equal(revised.teamRatings.length,2);
 assert.equal(revised.impact,2);
 assert.equal(two.teamRatings[0].impact,5);
 const design={...readDesign({}),issues:[revised]};
 assert.equal(readDesign(design).issues[0].teamRatings[0].impact,4);
 assert.throws(()=>readDesign({...design,issues:[{...issue,teamRatings:[{...first,urgency:6}]}]}));
});
test("board memo preserves the institution's choice, scopes alternatives and traces unique evidence",async()=>{
 const {boardDecisionMemo}=await import("../src/lib/strategy-design.ts");
 const design=readDesign({});
 assert.equal(boardDecisionMemo(design),null);
 const selected={id:"a",issueId:"q",title:"أ",internalId:"f1",externalId:"f2",scores:[1,2,2,2]};
 const decision={optionId:"a",reason:"مبرر المؤسسة",assumption:"افتراض"};
 const input={...design,decision,issues:[{id:"q",factorIds:["f1","missing"]}],
  factors:[{id:"f2"},{id:"f1"},{id:"unrelated"}],weights:[1,0,0,0],
  options:[selected,{...selected,id:"b",scores:[5,5,5,5]},{...selected,id:"c",issueId:"other"}]};
 const memo=boardDecisionMemo(input);
 assert.equal(memo.selected.id,"a");
 assert.deepEqual(memo.alternatives.map(a=>a.score),[1,5]);
 assert.deepEqual(memo.factors.map(f=>f.id),["f2","f1"]);
 assert.equal(memo.missingFactors,1);
 assert.throws(()=>boardDecisionMemo({...input,issues:[]}));
});
test("decision goals resolve by identity and retain visibility of unavailable links",async()=>{
 const {decisionGoals}=await import("../src/lib/strategy-design.ts");
 const goals=[{id:"one",title:"هدف"},{id:"two",title:"هدف"}];
 const decision={optionId:"o",reason:"مبرر",assumption:""};
 assert.deepEqual(decisionGoals(decision,goals),{linked:[],missing:0});
 const updated={...decision,goalIds:["two","gone","two"]};
 assert.deepEqual(decisionGoals(updated,goals),{linked:[goals[1]],missing:1});
 assert.equal(readDesign({...readDesign({}),decision:updated}).decision.goalIds[0],"two");
 assert.throws(()=>readDesign({...readDesign({}),decision:{...decision,goalIds:[null]}}));
});
test("annual ceilings isolate currencies, preserve missing estimates and accept zero ceilings",async()=>{
 const {annualBalance,validAnnualPlan}=await import("../src/lib/strategy-design.ts");
 const entry=(activityId,currency,amount)=>({activityId,currency,amount,resources:""});
 const items=[entry("a","USD",0.1),entry("b","USD",0.2),entry("c","ILS",50),entry("d","USD",null)];
 const p={year:2027,ceilings:{USD:0.3,ILS:0},items};
 assert.equal(validAnnualPlan(p),true);
 assert.deepEqual(annualBalance(p,"USD"),{committed:0.3,missing:1,balance:0,status:"incomplete"});
 assert.equal(annualBalance(p,"ILS").balance,-50);
 assert.equal(annualBalance(p,"EUR").status,"no_ceiling");
 assert.throws(()=>readDesign({...readDesign({}),annualPlans:[p,p]}));
 assert.equal(validAnnualPlan({...p,items:[...items,items[0]]}),false);
});
test("a board memo retains annual ceilings and unpriced commitments after a save round trip",async()=>{
 const {boardDecisionMemo,annualBalance}=await import("../src/lib/strategy-design.ts");
 const issue={id:"i",title:"سؤال",factorIds:[],impact:3,urgency:4,confidence:2};
 const option={id:"o",issueId:"i",title:"خيار",internalId:"a",externalId:"b",scores:[3,4,3,2]};
 const design={...readDesign({}),issues:[issue],options:[option],decision:{optionId:"o",reason:"مبرر",assumption:""}};
 assert.deepEqual(boardDecisionMemo(design).annualPlans,[]);
 const annual={year:2027,ceilings:{USD:100},items:[{activityId:"a",resources:"مدرب",currency:"USD",amount:null}]};
 const saved=readDesign(JSON.parse(JSON.stringify({...design,annualPlans:[annual]})));
 assert.deepEqual(boardDecisionMemo(saved).annualPlans,[annual]);
 assert.equal(annualBalance(boardDecisionMemo(saved).annualPlans[0],"USD").status,"incomplete");
});
