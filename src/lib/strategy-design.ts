export const methods = {
 "PESTEL": ["سياسي","اقتصادي","اجتماعي","تقني","بيئي","قانوني"],
 "أصحاب المصلحة": ["المستفيدون","الشركاء","الممولون","جهات التنظيم","فريق المؤسسة"],
 "القدرات الداخلية": ["الأفراد والخبرات","الموارد المالية","العمليات","التقنية والبيانات","الحوكمة"]
} as const;
export const quadrants = ["قوة","ضعف","فرصة","تهديد"] as const;
export type Method = keyof typeof methods;
export type Factor = {id:string; method:Method; category:string; statement:string; quadrant:string; source:string; date:string};
export type Design = {route:string; sector:string; duration:string; factors:Factor[];issues?:Issue[];options?:Option[];weights?:number[];decision?:Decision};
export function readDesign(value:unknown):Design{
 const empty={route:"",sector:"",duration:"",factors:[]};
 if(value && typeof value==="object" && !Array.isArray(value)){
  if(Object.keys(value).length===0)return empty;
  const d=value as Design;
  const rating=(n:number)=>Number.isInteger(n)&&n>=1&&n<=5;
  const issuesOk=d.issues===undefined||(Array.isArray(d.issues)&&d.issues.every(i=>i&&typeof i.id==="string"&&typeof i.title==="string"&&Array.isArray(i.factorIds)&&i.factorIds.every(id=>typeof id==="string")&&[i.impact,i.urgency,i.confidence].every(rating)));
  const optionsOk=d.options===undefined||(Array.isArray(d.options)&&d.options.every(o=>o&&[o.id,o.title,o.issueId,o.internalId,o.externalId].every(x=>typeof x==="string")&&Array.isArray(o.scores)&&o.scores.length===4&&o.scores.every(rating)));
  const weightsOk=d.weights===undefined||(Array.isArray(d.weights)&&d.weights.length===4&&d.weights.every(w=>Number.isFinite(w)&&w>=0&&w<=100)&&d.weights.some(w=>w>0));
  const decisionOk=d.decision===undefined||(d.decision&&[d.decision.optionId,d.decision.reason,d.decision.assumption].every(x=>typeof x==="string"));
  if(issuesOk&&optionsOk&&weightsOk&&decisionOk&&[d.route,d.sector,d.duration].every(x=>typeof x==="string") && Array.isArray(d.factors) &&
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

export type Issue={id:string;title:string;factorIds:string[];impact:number;urgency:number;confidence:number};
export type Option={id:string;title:string;issueId:string;internalId:string;externalId:string;scores:number[]};
export type Decision={optionId:string;reason:string;assumption:string};
export const criteria=["الأثر المتوقع","قابلية التنفيذ","توافر التمويل","القدرة على إدارة المخاطر"];
export function weightedScore(scores:number[],weights:number[]){
 if(scores.length!==criteria.length||weights.length!==criteria.length||
   weights.some(w=>!Number.isFinite(w)||w<0)||scores.some(s=>!Number.isInteger(s)||s<1||s>5))return null;
 const total=weights.reduce((sum,w)=>sum+w,0);
 return total>0?scores.reduce((sum,score,i)=>sum+score*weights[i],0)/total:null;
}
