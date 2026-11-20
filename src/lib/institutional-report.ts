import type {StrategicPlan,StrategicGoal,OperationalActivity,PerformanceIndicator} from "./institutional-planning";
import type {ActivityReport,KpiMeasurement} from "./progress-metrics";

/** A period's actuals are cumulative readings with event dates on or before the cut-off.
 * Earlier readings remain relevant; summing cumulative progress would double-count.
 * Reports entered later with an earlier event date are included and labelled accordingly.
 */
export type ReportPeriod="month"|"quarter"|"year";
export type DeliveryFlag="scheduled"|"completed"|"blocked"|"overdue"|"in_progress"|"unreported";
export type Attainment="met"|"not_met"|"unmeasured"|"unknown_direction";
export type ReportWindow={start:string;end:string;label:string};
export type ActivityLine={
 id:string;goalTitle:string;title:string;owner:string;start:string|null;end:string|null;
 target:number|null;unit:string;budget:number|null;currency:string;
 actualQuantity:number|null;spent:number|null;progress:number|null;
 reportDate:string|null;reference:string;summary:string;flag:DeliveryFlag;
};
export type IndicatorLine={
 id:string;goalTitle:string;title:string;unit:string;baseline:number|null;target:number|null;
 actual:number|null;gap:number|null;direction:"up"|"down"|null;attainment:Attainment;
 measuredOn:string|null;reference:string;
};
export type CurrencyLine={
 currency:string;planned:number|null;spent:number|null;
 plannedCount:number;spentCount:number;missingPlanned:number;missingSpent:number;
 variance:number|null;
};
export type PeriodicReport={
 window:ReportWindow;asOf:string;hasStarted:boolean;
 activityLines:ActivityLine[];indicatorLines:IndicatorLine[];currencies:CurrencyLine[];
 totals:{activities:number;completed:number;overdue:number;blocked:number;
  scheduled:number;unreported:number;withReports:number;
  periodActivityUpdates:number;periodKpiReadings:number;indicators:number;
  measured:number;met:number;notMet:number;unassessable:number};
};

const pad=(value:number)=>String(value).padStart(2,"0");
const yearLabel=(year:number)=>String(year);
export function reportWindow(period:ReportPeriod,year:number,slot=1):ReportWindow{
 if(!Number.isInteger(year)||year<1900||year>2200)throw new Error("سنة التقرير غير صالحة");
 if(period==="year")return {start:`${year}-01-01`,end:`${year}-12-31`,label:`التقرير السنوي ${yearLabel(year)}`};
 if(period==="quarter"){
  if(!Number.isInteger(slot)||slot<1||slot>4)throw new Error("رقم الربع غير صالح");
  const month=(slot-1)*3+1;
  const endMonth=month+2;
  const last=new Date(Date.UTC(year,endMonth,0)).getUTCDate();
  return {start:`${year}-${pad(month)}-01`,end:`${year}-${pad(endMonth)}-${pad(last)}`,
   label:`تقرير الربع ${slot} لسنة ${yearLabel(year)}`};
 }
 if(period!=="month"||!Number.isInteger(slot)||slot<1||slot>12)throw new Error("شهر التقرير غير صالح");
 const last=new Date(Date.UTC(year,slot,0)).getUTCDate();
 return {start:`${year}-${pad(slot)}-01`,end:`${year}-${pad(slot)}-${pad(last)}`,
  label:`التقرير الشهري ${pad(slot)}/${yearLabel(year)}`};
}
export function asOfCutoff(plan:Pick<StrategicPlan,"period_end">,window:ReportWindow,today:string){
 return [plan.period_end,window.end,today].sort()[0];
}
function finite(value:number|null|undefined):number|null{
 if(value==null)return null;
 const n=Number(value);
 return Number.isFinite(n)?n:null;
}
function latestAt<T extends {id:string;created_at:string}>(rows:T[],key:(row:T)=>string,date:(row:T)=>string,asOf:string,from:string){
 const latest=new Map<string,T>();
 for(const row of rows){
  const day=date(row);
  if(day>asOf||day<from)continue;
  const old=latest.get(key(row));
  if(!old||day>date(old)||(day===date(old)&&
     (row.created_at>old.created_at||(row.created_at===old.created_at&&row.id>old.id))))
    latest.set(key(row),row);
 }
 return latest;
}
export function buildPeriodicReport(input:{
 plan:Pick<StrategicPlan,"period_start"|"period_end">;
 goals:StrategicGoal[];activities:OperationalActivity[];indicators:PerformanceIndicator[];
 reports:ActivityReport[];measurements:KpiMeasurement[];
 period:ReportPeriod;year:number;slot:number;today:string;
}):PeriodicReport{
 const window=reportWindow(input.period,input.year,input.slot);
 const asOf=asOfCutoff(input.plan,window,input.today);
 const start=[input.plan.period_start,window.start].sort().at(-1)!;
 const hasStarted=asOf>=start;
 const goals=new Map(input.goals.map(g=>[g.id,g.title]));
 const reports=latestAt(input.reports,r=>r.activity_id,r=>r.report_date,asOf,input.plan.period_start);
 const measurements=latestAt(input.measurements,r=>r.indicator_id,r=>r.measured_on,asOf,input.plan.period_start);
 const activityLines:ActivityLine[]=input.activities.map(a=>{
  const current=hasStarted?reports.get(a.id):undefined;
  const progress=finite(current?.progress_percent);
  let flag:DeliveryFlag;
  if(!hasStarted||(a.planned_start!=null&&a.planned_start>asOf))flag="scheduled";
  else if(current?.delivery_status==="completed"&&progress===100)flag="completed";
  else if(current?.delivery_status==="blocked")flag="blocked";
  else if(a.planned_end!=null&&a.planned_end<asOf)flag="overdue";
  else if(current)flag="in_progress";
  else flag="unreported";
  return {id:a.id,goalTitle:goals.get(a.goal_id)??"هدف غير متاح",title:a.title,
   owner:a.owner_name,start:a.planned_start,end:a.planned_end,target:finite(a.target_quantity),
   unit:a.target_unit,budget:finite(a.estimated_budget),currency:a.currency_code,
   actualQuantity:current?finite(current.actual_quantity_to_date):null,
   spent:current?finite(current.spent_to_date):null,progress:current?progress:null,
   reportDate:current?.report_date??null,reference:current?.evidence_reference??"",
   summary:current?.summary??"",flag};
 });
 const indicatorLines:IndicatorLine[]=input.indicators.map(k=>{
  const current=hasStarted?measurements.get(k.id):undefined;
  const baseline=finite(k.baseline),target=finite(k.target),actual=current?finite(current.actual_value):null;
  const direction=baseline==null||target==null||baseline===target?null:target>baseline?"up":"down";
  let attainment:Attainment="unmeasured";
  if(actual!=null){
   if(direction===null)attainment="unknown_direction";
   else attainment=direction==="up"?(actual>=target!?"met":"not_met"):(actual<=target!?"met":"not_met");
  }
  return {id:k.id,goalTitle:goals.get(k.goal_id)??"هدف غير متاح",title:k.title,
   unit:k.unit,baseline,target,actual,gap:target!=null&&actual!=null?actual-target:null,
   direction,attainment,measuredOn:current?.measured_on??null,
   reference:current?.evidence_reference??""};
 });
 const budget=new Map<string,{planned:number;spent:number;pc:number;sc:number;mp:number;ms:number}>();
 for(const a of activityLines){
  const b=budget.get(a.currency)??{planned:0,spent:0,pc:0,sc:0,mp:0,ms:0};
  if(a.budget==null)b.mp++;else{b.planned+=a.budget;b.pc++;}
  if(a.spent==null)b.ms++;else{b.spent+=a.spent;b.sc++;}
  budget.set(a.currency,b);
 }
 const currencies=[...budget.entries()].map(([currency,b]):CurrencyLine=>({
  currency,planned:b.pc?b.planned:null,spent:b.sc?b.spent:null,
  plannedCount:b.pc,spentCount:b.sc,missingPlanned:b.mp,missingSpent:b.ms,
  variance:b.mp===0&&b.ms===0?b.planned-b.spent:null
 })).sort((a,b)=>a.currency.localeCompare(b.currency));
 const counted=hasStarted?input.reports.filter(r=>r.report_date>=start&&r.report_date<=asOf):[];
 const measured=hasStarted?input.measurements.filter(r=>r.measured_on>=start&&r.measured_on<=asOf):[];
 return {window,asOf,hasStarted,activityLines,indicatorLines,currencies,
  totals:{
   activities:activityLines.length,
   completed:activityLines.filter(a=>a.flag==="completed").length,
   overdue:activityLines.filter(a=>a.flag==="overdue").length,
   blocked:activityLines.filter(a=>a.flag==="blocked").length,
   scheduled:activityLines.filter(a=>a.flag==="scheduled").length,
   unreported:activityLines.filter(a=>a.flag==="unreported").length,
   withReports:activityLines.filter(a=>a.reportDate!=null).length,
   periodActivityUpdates:counted.length,periodKpiReadings:measured.length,
   indicators:indicatorLines.length,measured:indicatorLines.filter(k=>k.actual!=null).length,
   met:indicatorLines.filter(k=>k.attainment==="met").length,
   notMet:indicatorLines.filter(k=>k.attainment==="not_met").length,
   unassessable:indicatorLines.filter(k=>k.attainment==="unknown_direction").length
  }};
}
