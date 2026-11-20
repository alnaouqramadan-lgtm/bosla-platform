import type {FormReview} from "./form-review";

/**
 * Print/export models built strictly from finalised facilitator reviews.
 * Uncollected fields intentionally remain empty: source inputs are free text,
 * and matching activities to goals by line number is not a safe inference.
 */
export type ActivityRow = {
  number:number; project:string; goal:string; audience:string; quantity:string;
  period:string; responsible:string; estimatedCost:string;
};
export type IndicatorRow = {
  number:number; goal:string; indicator:string; baseline:string;
  target:string; verification:string; frequency:string;
};
export type WorksheetData = {
  goals:string[]; activities:ActivityRow[]; indicators:IndicatorRow[];
  stageFourApproved:boolean; stageFiveApproved:boolean;
  expectedResults:string; implementationNeeds:string; risks:string;
  implementationMonitoring:string; successCriteria:string; evaluation:string;
  dataNote:string;
};

export function approvedValue(reviews:FormReview[], stage:number, key:string):string {
  const review=reviews.find(r=>r.stage===stage && Boolean(r.finalized_at));
  return review?.fields[key]?.content?.trim()||"";
}

export function items(value:string):string[] {
  return value.split(/\r?\n/g).map(s=>s.trim()).filter(Boolean);
}
function at(values:string[], index:number):string {return values[index]||"";}
function combineParts(parts:{label:string;items:string[]}[], index:number):string {
  return parts.map(p=>at(p.items,index)?p.label+": "+at(p.items,index):"").filter(Boolean).join(" | ");
}

export function worksheetData(reviews:FormReview[]):WorksheetData {
  const val=(stage:number,key:string)=>approvedValue(reviews,stage,key);
  const goals=items(val(3,"goals"));
  const programs=items(val(4,"programs"));
  const projects=items(val(4,"projects"));
  const activities=items(val(4,"activities"));
  const audience=items(val(4,"beneficiaries"));
  const periods=items(val(4,"timelines"));
  const responsible=items(val(4,"responsibilities"));
  const cost=items(val(4,"estimated_costs"));
  const activityCount=Math.max(5,programs.length,projects.length,activities.length,
    audience.length,periods.length,responsible.length,cost.length);
  const activityRows:ActivityRow[]=Array.from({length:activityCount},(_,i)=>({
    number:i+1,
    project:combineParts([{label:"البرنامج",items:programs},{label:"المشروع",items:projects},
      {label:"النشاط",items:activities}],i),
    goal:"", audience:at(audience,i), quantity:"",
    period:at(periods,i), responsible:at(responsible,i),estimatedCost:at(cost,i)
  }));
  const indicators=items(val(5,"kpis"));
  const baseline=items(val(5,"baselines"));
  const targets=items(val(5,"targets"));
  const verification=items(val(5,"verification"));
  const indicatorCount=Math.max(5,indicators.length,baseline.length,targets.length,verification.length);
  const indicatorRows:IndicatorRow[]=Array.from({length:indicatorCount},(_,i)=>({
    number:i+1, goal:"",indicator:at(indicators,i),baseline:at(baseline,i),
    target:at(targets,i),verification:at(verification,i),frequency:""
  }));
  return {
    goals,activities:activityRows,indicators:indicatorRows,
    stageFourApproved:reviews.some(r=>r.stage===4 && Boolean(r.finalized_at)),
    stageFiveApproved:reviews.some(r=>r.stage===5 && Boolean(r.finalized_at)),
    expectedResults:val(3,"expected_results"),
    implementationNeeds:"",risks:"",implementationMonitoring:"",
    successCriteria:"",evaluation:val(5,"followup"),
    dataNote:"رُتبت البيانات المتعددة حسب ترتيب الأسطر في كل حقل. الربط بالأهداف والكمية ودورية القياس يستلزم مراجعة بشرية؛ لم يتم تخمين قيم غير مدخلة."
  };
}
