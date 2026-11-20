import type {WorksheetGroup} from "./worksheet-model";
function worksheetValue(g:WorksheetGroup,stage:number,key:string):string{
  return g.values[stage+":"+key]??"";
}

export type ExecutionRow={
  number:number; activity:string; goal:string; audience:string; quantity:string;
  period:string; manager:string; cost:string;
};
export type PerformanceRow={
  number:number; goal:string; kpi:string; baseline:string; target:string;
  verification:string; frequency:string;
};
function lines(g:WorksheetGroup,stage:number,key:string):string[]{
  return worksheetValue(g,stage,key).split(/\r?\n/g).map(s=>s.trim()).filter(Boolean);
}
function get(values:string[],i:number){return values[i]??"";}
function combined(i:number,parts:{label:string;values:string[]}[]):string{
  return parts.map(p=>get(p.values,i)?p.label+": "+get(p.values,i):"").filter(Boolean).join(" | ");
}
// Data in earlier workshop forms is stored in independent text areas.
// Positionally align their entries for editable output, but never invent
// a goal association, target quantity or measurement frequency.
export function executionRows(g:WorksheetGroup):ExecutionRow[]{
  const programs=lines(g,4,"programs"),projects=lines(g,4,"projects");
  const activities=lines(g,4,"activities"),audience=lines(g,4,"beneficiaries");
  const periods=lines(g,4,"timelines"),managers=lines(g,4,"responsibilities");
  const costs=lines(g,4,"estimated_costs");
  const count=Math.max(5,programs.length,projects.length,activities.length,
    audience.length,periods.length,managers.length,costs.length);
  return Array.from({length:count},(_,i)=>({
    number:i+1,
    activity:combined(i,[{label:"برنامج",values:programs},{label:"مشروع",values:projects},
      {label:"نشاط",values:activities}]),
    goal:"",audience:get(audience,i),quantity:"",
    period:get(periods,i),manager:get(managers,i),cost:get(costs,i)
  }));
}
export function performanceRows(g:WorksheetGroup):PerformanceRow[]{
  const kpis=lines(g,5,"kpis"),baseline=lines(g,5,"baselines");
  const targets=lines(g,5,"targets"),verification=lines(g,5,"verification");
  const count=Math.max(5,kpis.length,baseline.length,targets.length,verification.length);
  return Array.from({length:count},(_,i)=>({
    number:i+1,goal:"",kpi:get(kpis,i),baseline:get(baseline,i),
    target:get(targets,i),verification:get(verification,i),frequency:""
  }));
}
export function goalsForGroup(g:WorksheetGroup):string[]{return lines(g,3,"goals");}
export function impactForGroup(g:WorksheetGroup):string[]{return lines(g,3,"expected_results");}
export function followupForGroup(g:WorksheetGroup):string[]{return lines(g,5,"followup");}

export const worksheetDataNote="حُوفظ على ترتيب الأسطر كما أدخلته المجموعة. "
 +"يجب التحقق من ارتباط كل نشاط أو مؤشر بهدف محدد، وتعبئة الكمية ودورية القياس من المصدر؛ "
 +"الخانات غير المسجلة تُترك فارغة دون تخمين.";
