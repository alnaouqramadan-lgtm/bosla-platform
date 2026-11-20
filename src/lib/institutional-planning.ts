export type StrategicPlan={
 id:string;organization_id:string;source_workshop_id:string|null;created_by:string;
 title:string;period_start:string;period_end:string;vision:string;mission:string;
 institutional_values:string;environmental_analysis:string;status:"draft";
 revision:number;created_at:string;updated_at:string;
};
export type StrategicGoal={
 id:string;plan_id:string;organization_id:string;code:string;title:string;
 description:string;strategic_axis:string;priority:number;sort_order:number;
};
export type OperationalActivity={
 id:string;plan_id:string;organization_id:string;goal_id:string;program_name:string;
 project_name:string;title:string;target_group:string;target_quantity:number|null;
 target_unit:string;owner_name:string;planned_start:string|null;planned_end:string|null;
 estimated_budget:number|null;currency_code:"ILS"|"USD"|"EUR"|"JOD"|"EGP";
 risk_notes:string;status:"planned";
};
export type PerformanceIndicator={
 id:string;plan_id:string;organization_id:string;goal_id:string;
 title:string;unit:string;baseline:number|null;target:number|null;
 verification_source:string;frequency:"monthly"|"quarterly"|"semiannual"|"annual";
 methodology:string;
};
export const frequencyLabels={
 monthly:"شهري",quarterly:"ربع سنوي",semiannual:"نصف سنوي",annual:"سنوي"
} as const;
export function optionalNonnegative(value:string):number|null{
 const trimmed=value.trim();
 if(!trimmed)return null;
 const number=Number(trimmed);
 if(!Number.isFinite(number)||number<0)throw new Error("القيمة يجب أن تكون رقمًا غير سالب.");
 return number;
}
export function optionalNumber(value:string):number|null{
 const trimmed=value.trim();
 if(!trimmed)return null;
 const number=Number(trimmed);
 if(!Number.isFinite(number))throw new Error("تحقّق من الرقم المدخل.");
 return number;
}
export function validatePlanPeriod(start:string,end:string):void{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start){
  throw new Error("تاريخ نهاية الخطة يجب ألا يسبق تاريخ بدايتها.");
 }
}
export function splitApprovedGoals(content:string):string[]{
 return [...new Set(content.split(/\r?\n/g).map(line=>line.trim()).filter(Boolean))];
}
