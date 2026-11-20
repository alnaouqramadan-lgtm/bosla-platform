export type ActivityReport={
 id:string;organization_id:string;plan_id:string;activity_id:string;
 report_date:string;progress_percent:number;actual_quantity_to_date:number|null;
 spent_to_date:number|null;delivery_status:"in_progress"|"completed"|"blocked";
 summary:string;evidence_reference:string;created_at:string;
};
export type KpiMeasurement={
 id:string;organization_id:string;plan_id:string;indicator_id:string;
 measured_on:string;actual_value:number;evidence_reference:string;
 notes:string;created_at:string;
};
export type PlanRevision={
 id:string;plan_id:string;organization_id:string;version:number;
 approved_at:string;approved_by:string;snapshot:Record<string,unknown>;
};
export type PlannedActivityBrief={id:string;planned_end:string|null};
export function latestById<T extends {created_at:string;id:string}>(
 rows:T[],reference:(item:T)=>string
):Map<string,T>{
 const latest=new Map<string,T>();
 for(const row of rows){
  const key=reference(row),old=latest.get(key);
  if(!old||row.created_at>old.created_at||
   (row.created_at===old.created_at&&row.id>old.id))latest.set(key,row);
 }
 return latest;
}
export function deliveryOverview(
 activities:PlannedActivityBrief[],
 reports:ActivityReport[],
 today:string
){
 const latest=latestById(reports,x=>x.activity_id);
 let completed=0,overdue=0,withReports=0;
 for(const activity of activities){
  const report=latest.get(activity.id);
  if(report)withReports++;
  if(report?.delivery_status==="completed"&&Number(report.progress_percent)===100)completed++;
  else if(activity.planned_end&&activity.planned_end<today)overdue++;
 }
 return {total:activities.length,withReports,completed,overdue,
  unreported:activities.length-withReports};
}
