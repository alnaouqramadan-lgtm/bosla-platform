export const methods = {
 "PESTEL": ["سياسي","اقتصادي","اجتماعي","تقني","بيئي","قانوني"],
 "أصحاب المصلحة": ["المستفيدون","الشركاء","الممولون","جهات التنظيم","فريق المؤسسة"],
 "القدرات الداخلية": ["الأفراد والخبرات","الموارد المالية","العمليات","التقنية والبيانات","الحوكمة"]
} as const;
export const quadrants = ["قوة","ضعف","فرصة","تهديد"] as const;
export type Method = keyof typeof methods;
export type Factor = {id:string; method:Method; category:string; statement:string; quadrant:string; source:string; date:string};
export type Design = {annualPlans?:AnnualPlan[];route:string; sector:string; duration:string; workshopMinutes?:number; factors:Factor[];issues?:Issue[];options?:Option[];weights?:number[];decision?:Decision};
export function readDesign(value:unknown):Design{
 const empty={route:"",sector:"",duration:"",factors:[]};
 if(value && typeof value==="object" && !Array.isArray(value)){
  if(Object.keys(value).length===0)return empty;
  const d=value as Design;
  const rating=(n:number)=>Number.isInteger(n)&&n>=1&&n<=5;
  const issuesOk=d.issues===undefined||(Array.isArray(d.issues)&&d.issues.every(i=>i&&typeof i.id==="string"&&typeof i.title==="string"&&Array.isArray(i.factorIds)&&i.factorIds.every(id=>typeof id==="string")&&[i.impact,i.urgency,i.confidence].every(rating)&&
    (i.teamRatings===undefined||(Array.isArray(i.teamRatings)&&i.teamRatings.every(t=>t&&typeof t.team==="string"&&t.team.trim().length>0&&typeof t.note==="string"&&[t.impact,t.urgency,t.confidence].every(rating))))));
  const optionsOk=d.options===undefined||(Array.isArray(d.options)&&d.options.every(o=>o&&[o.id,o.title,o.issueId,o.internalId,o.externalId].every(x=>typeof x==="string")&&Array.isArray(o.scores)&&o.scores.length===4&&o.scores.every(rating)));
  const weightsOk=d.weights===undefined||(Array.isArray(d.weights)&&d.weights.length===4&&d.weights.every(w=>Number.isFinite(w)&&w>=0&&w<=100)&&d.weights.some(w=>w>0));
  const decisionOk=d.decision===undefined||(d.decision&&(d.decision.goalIds===undefined||(Array.isArray(d.decision.goalIds)&&d.decision.goalIds.every(id=>typeof id==="string"&&id.length>0)))&&[d.decision.optionId,d.decision.reason,d.decision.assumption].every(x=>typeof x==="string"));
  const timeOk=d.workshopMinutes===undefined||validWorkshopMinutes(d.workshopMinutes);
  if((d.annualPlans===undefined||(Array.isArray(d.annualPlans)&&d.annualPlans.every(validAnnualPlan)&&new Set(d.annualPlans.map(a=>a.year)).size===d.annualPlans.length))&&timeOk&&issuesOk&&optionsOk&&weightsOk&&decisionOk&&[d.route,d.sector,d.duration].every(x=>typeof x==="string") && Array.isArray(d.factors) &&
    d.factors.every(f=>f && Object.hasOwn(methods,f.method) &&
     [f.id,f.category,f.statement,f.quadrant,f.source,f.date].every(x=>typeof x==="string")))return d;
 }
 throw new Error("تعذّر قراءة سجل التحليل المحفوظ.");
}
export function workshopAgenda(route:string){
 return route==="تحديث استراتيجية قائمة"
 ? ["مراجعة افتراضات الاستراتيجية السابقة","تحديد ما تغيّر في البيئة والقدرات","مراجعة الأولويات والبدائل","عرض التعديلات المقترحة للاعتماد"]
 : ["تحديد نطاق الاستراتيجية والفئات المعنية","جمع الأدلة وتحليل البيئة والقدرات","ترتيب القضايا وبناء البدائل","اختيار التوجه وعرضه للاعتماد"];
}

export type TeamRating={team:string;impact:number;urgency:number;confidence:number;note:string};
export type Issue={teamRatings?:TeamRating[];id:string;title:string;factorIds:string[];impact:number;urgency:number;confidence:number};
export type Option={id:string;title:string;issueId:string;internalId:string;externalId:string;scores:number[]};
export type Decision={goalIds?:string[];optionId:string;reason:string;assumption:string};
export const criteria=["الأثر المتوقع","قابلية التنفيذ","توافر التمويل","القدرة على إدارة المخاطر"];
export function weightedScore(scores:number[],weights:number[]){
 if(scores.length!==criteria.length||weights.length!==criteria.length||
   weights.some(w=>!Number.isFinite(w)||w<0)||scores.some(s=>!Number.isInteger(s)||s<1||s>5))return null;
 const total=weights.reduce((sum,w)=>sum+w,0);
 return total>0?scores.reduce((sum,score,i)=>sum+score*weights[i],0)/total:null;
}

export const sectorPreparation = {
 "إنساني وتنموي": "ما الاحتياج الذي تغيّر؟ أحضروا آخر تقييم للاحتياجات وخريطة تغطية الشركاء.",
 "تعليمي": "أي فئة تواجه فجوة في الوصول أو التعلّم؟ أحضروا بيانات الالتحاق ونتائج التعلّم.",
 "صحي": "أين تتعطل إتاحة الخدمة؟ أحضروا بيانات مجمعة عن الطلب والطاقة الاستيعابية وأوقات الانتظار.",
 "تجاري": "ما الذي تغيّر في الطلب وتكلفة تقديم الخدمة؟ أحضروا اتجاهات المبيعات وملاحظات العملاء.",
 "حكومي وبلدي": "أي خدمة عامة تستدعي إعادة ترتيب الأولويات؟ أحضروا بيانات التغطية وشكاوى المواطنين."
} as const;
export function validWorkshopMinutes(value:unknown):value is number{
 return typeof value==="number" && Number.isSafeInteger(value) && value>=4 && value<=10080;
}
export function prepareWorkshop(route:string,sector:string,minutes?:number){
 const updating=route==="تحديث استراتيجية قائمة";
 const agenda=workshopAgenda(route);
 const weights=updating?[25,30,30,15]:[15,35,30,20];
 const sectorQuestion=Object.hasOwn(sectorPreparation,sector.trim())
  ?sectorPreparation[sector.trim() as keyof typeof sectorPreparation]
  :"حدّدوا أهم تغيّر في القطاع، وأحضروا مصدرًا حديثًا يوضح أثره على المؤسسة.";
 const preparation=updating
  ?"أحضروا الاستراتيجية الحالية وحدّدوا الافتراضات التي تحتاج إلى مراجعة."
  :"أحضروا تعريف المؤسسة والفئات المستهدفة والبيانات المتاحة عن احتياجاتها.";
 const outputs=[
  updating?"قائمة الافتراضات محل المراجعة":"نطاق الاستراتيجية وأصحاب المصلحة",
  "عوامل مصنفة في SWOT مع مصادر الأدلة",
  "قضايا مرتبة وبدائل موثقة",
  updating?"مذكرة بالتعديلات وأسبابها":"توجه موصى به وأسباب اختياره"
 ];
 let cumulative=0,previous=0;
 const sessions=agenda.map((title,index)=>{
  cumulative+=weights[index];
  // Reserve one minute per session before allocating the rest by cumulative weight.
  const end=validWorkshopMinutes(minutes)?index+1+Math.round((minutes-agenda.length)*cumulative/100):null;
  const allocated=end===null?null:end-previous;
  previous=end??0;
  return {title,output:outputs[index],minutes:allocated};
 });
 return {preparation,sectorQuestion,sessions};
}

export const ratingAxes = {impact:"الأثر",urgency:"الإلحاح",confidence:"الثقة بالأدلة"} as const;
export type RatingAxis=keyof typeof ratingAxes;
const teamKey=(team:string)=>team.trim().replace(/\s+/g," ").normalize("NFC").toLocaleLowerCase();
export function withTeamRating(issue:Issue,rating:TeamRating):Issue{
 const rows=issue.teamRatings??[];
 const entry={...rating,team:rating.team.trim().replace(/\s+/g," "),note:rating.note.trim()};
 const index=rows.findIndex(r=>teamKey(r.team)===teamKey(entry.team));
 return {...issue,teamRatings:index<0?[...rows,entry]:rows.map((r,i)=>i===index?entry:r)};
}
export function teamSpread(rows:TeamRating[],axis:RatingAxis){
 if(rows.length<2)return null;
 const values=rows.map(r=>r[axis]);
 return Math.max(...values)-Math.min(...values);
}

export function boardDecisionMemo(design:Design){
 const decision=design.decision;
 if(!decision)return null;
 const options=design.options??[];
 const selected=options.find(option=>option.id===decision.optionId);
 const issue=design.issues?.find(item=>item.id===selected?.issueId);
 if(!selected||!issue)throw new Error("تعذّر ربط التوصية بالقضية أو البديل المحفوظ.");
 const weights=design.weights??[25,25,25,25];
 const alternatives=options.filter(option=>option.issueId===issue.id).map(option=>({
  ...option,score:weightedScore(option.scores,weights)
 }));
 const factorIds=new Set([...issue.factorIds,selected.internalId,selected.externalId]);
 const factors=design.factors.filter(factor=>factorIds.has(factor.id));
 return {decision,selected,issue,weights,alternatives,factors,annualPlans:design.annualPlans??[],missingFactors:factorIds.size-factors.length};
}

export function decisionGoals<T extends {id:string}>(decision:Decision,goals:T[]){
 const ids=new Set(decision.goalIds??[]);
 const linked=goals.filter(goal=>ids.has(goal.id));
 return {linked,missing:ids.size-linked.length};
}

export const annualCurrencies=["ILS","USD","EUR","JOD","EGP"] as const;
export type AnnualCurrency=typeof annualCurrencies[number];
export type AnnualItem={activityId:string;currency:AnnualCurrency;amount:number|null;resources:string};
export type AnnualPlan={year:number;ceilings:Partial<Record<AnnualCurrency,number>>;items:AnnualItem[]};
const validMoney=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=1e12;
export function validAnnualPlan(p:AnnualPlan):boolean{
 return !!p&&Number.isInteger(p.year)&&p.year>=1&&p.year<=9999&&!!p.ceilings&&typeof p.ceilings==="object"&&!Array.isArray(p.ceilings)
  &&Object.entries(p.ceilings).every(([code,amount])=>annualCurrencies.some(c=>c===code)&&validMoney(amount))
  &&Array.isArray(p.items)&&p.items.every(i=>i&&typeof i.activityId==="string"&&i.activityId.length>0&&annualCurrencies.includes(i.currency)
   &&(i.amount===null||validMoney(i.amount))&&typeof i.resources==="string")
  &&new Set(p.items.map(i=>i.activityId)).size===p.items.length;
}
export function annualBalance(plan:AnnualPlan,currency:AnnualCurrency){
 const rows=plan.items.filter(i=>i.currency===currency);
 const committed=Math.round(rows.reduce((sum,i)=>sum+(i.amount??0),0)*1000)/1000;
 const missing=rows.filter(i=>i.amount===null).length;
 const ceiling=plan.ceilings[currency];
 const balance=ceiling===undefined?null:Math.round((ceiling-committed)*1000)/1000;
 const status=balance===null?"no_ceiling":balance<0?"over":missing?"incomplete":"within";
 return {committed,missing,balance,status} as const;
}
