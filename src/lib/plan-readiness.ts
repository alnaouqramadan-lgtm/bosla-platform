import type {StrategicPlan,StrategicGoal,OperationalActivity,PerformanceIndicator} from "./institutional-planning";

export type ReadinessTab="vision"|"goals"|"activities"|"indicators";
export type ReadinessCheck={
 id:string;tab:ReadinessTab;required:boolean;passed:boolean;
 title:string;detail:string;
};
export type ReadinessAssessment={
 checks:ReadinessCheck[];
 mandatoryPassed:number;mandatoryTotal:number;
 recommendationsPassed:number;recommendationsTotal:number;
 canPublish:boolean;mandatoryMissing:number;
};
const completed=(value:string|null|undefined)=>Boolean(value?.trim());
const all=<T>(rows:T[],condition:(row:T)=>boolean)=>rows.length>0&&rows.every(condition);
const isNumber=(value:number|null|undefined)=>value!=null&&Number.isFinite(Number(value));

/**
 * Readiness is an input-completeness checklist, not a quality assessment, legal
 * approval or predicted outcome. Mandatory checks mirror publication RPC.
 * Advisory checks are non-blocking and never invent missing numbers.
 */
export function assessPlanReadiness(input:{
 plan:Pick<StrategicPlan,"vision"|"mission"|"institutional_values"|"environmental_analysis"|"period_start"|"period_end">;
 goals:StrategicGoal[];activities:OperationalActivity[];indicators:PerformanceIndicator[];
}):ReadinessAssessment{
 const {plan,goals,activities,indicators}=input;
 const checks:ReadinessCheck[]=[];
 const add=(id:string,tab:ReadinessTab,required:boolean,passed:boolean,title:string,detail:string)=>{
  checks.push({id,tab,required,passed,title,detail});
 };
 add("vision","vision",true,plan.vision.trim().length>=3,
  "صياغة الرؤية","حدّد رؤية واضحة لا تقل عن ثلاثة أحرف.");
 add("mission","vision",true,plan.mission.trim().length>=3,
  "صياغة الرسالة","حدّد رسالة واضحة لا تقل عن ثلاثة أحرف.");
 add("goals","goals",true,goals.length>0,
  "وجود هدف استراتيجي","يلزم هدف استراتيجي واحد على الأقل.");
 add("activities","activities",true,activities.length>0,
  "وجود نشاط تشغيلي","يلزم نشاط واحد على الأقل مرتبط بأحد الأهداف.");
 add("indicators","indicators",true,indicators.length>0,
  "وجود مؤشر أداء","يلزم مؤشر أداء واحد على الأقل مرتبط بهدف.");
 add("targets","indicators",true,all(indicators,k=>isNumber(k.target)),
  "مستهدف رقمي لكل مؤشر","كل مؤشر أداء يحتاج إلى قيمة مستهدفة قابلة للقياس؛ لا تستبدل القيمة المفقودة بصفر.");
 add("verification","indicators",true,all(indicators,k=>completed(k.verification_source)),
  "مصدر تحقق لكل مؤشر","كل مؤشر يحتاج إلى مصدر للتحقق من النتائج الفعلية.");
 add("values","vision",false,completed(plan.institutional_values),
  "القيم المؤسسية","توثيق المبادئ والقيم التي تستند إليها الخطة.");
 add("context","vision",false,completed(plan.environmental_analysis),
  "تحليل البيئة","توثيق نتائج التحليل البيئي والقضايا الاستراتيجية.");
 add("goal_axes","goals",false,all(goals,g=>completed(g.strategic_axis)),
  "محور لكل هدف","ربط الأهداف بمحاور استراتيجية واضحة.");
 add("goal_descriptions","goals",false,all(goals,g=>completed(g.description)),
  "نتائج متوقعة لكل هدف","تحديد النتائج المرجوة لتوضيح المقصود من كل هدف.");
 add("owners","activities",false,all(activities,a=>completed(a.owner_name)),
  "مسؤول محدد لكل نشاط","توثيق الجهة المسؤولة عن تنفيذ كل نشاط.");
 add("schedule","activities",false,all(activities,a=>a.planned_start!=null&&a.planned_end!=null),
  "تاريخا البداية والنهاية لكل نشاط","عدم تحديد موعد يجعل تفسير التأخر صعبًا.");
 add("schedule_in_period","activities",false,all(activities,a=>
    a.planned_start!=null&&a.planned_end!=null&&
    a.planned_start>=plan.period_start&&a.planned_end<=plan.period_end
  ),"اتساق المواعيد مع فترة الخطة","راجع الأنشطة التي تقع تواريخها خارج فترة الخطة المعتمدة.");
 add("quantities","activities",false,all(activities,a=>
   isNumber(a.target_quantity)&&completed(a.target_unit)),
  "مستهدف كمي بوحدة لكل نشاط","يوصى بتحديد الكمية المستهدفة ووحدة قياسها، ولا يُفترض أن القيمة صفر.");
 add("budgets","activities",false,all(activities,a=>isNumber(a.estimated_budget)),
  "موازنة تقديرية لكل نشاط","ضع تقديرًا للعملات المناسبة أو اتركها فارغة لتجنب تقديرات غير موثقة.");
 add("risks","activities",false,all(activities,a=>completed(a.risk_notes)),
  "توثيق المخاطر والاحتياجات","اكتب المخاطر أو سبب عدم وجود مخاطر مؤثرة عند الاقتضاء.");
 add("baselines","indicators",false,all(indicators,k=>isNumber(k.baseline)),
  "خط أساس لكل مؤشر","يساعد خط الأساس على تفسير اتجاه المؤشر ومستوى التحسن.");
 add("kpi_methods","indicators",false,all(indicators,k=>completed(k.methodology)),
  "طريقة حساب لكل مؤشر","توثيق كيفية احتساب المؤشر ومعالجة أخطاء القياس.");
 add("kpi_direction","indicators",false,all(indicators,k=>
  isNumber(k.baseline)&&isNumber(k.target)&&k.baseline!==k.target),
  "اتجاه نجاح قابل للاستنتاج","للمقارنة الآلية، يحتاج المؤشر إلى خط أساس يختلف عن المستهدف، أو إلى تحديد اتجاه صريح مستقبلًا.");
 const must=checks.filter(c=>c.required);
 const advisory=checks.filter(c=>!c.required);
 const mandatoryPassed=must.filter(c=>c.passed).length;
 return {checks,mandatoryPassed,mandatoryTotal:must.length,
  recommendationsPassed:advisory.filter(c=>c.passed).length,recommendationsTotal:advisory.length,
  canPublish:mandatoryPassed===must.length,mandatoryMissing:must.length-mandatoryPassed};
}
