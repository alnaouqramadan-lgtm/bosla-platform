"use client";
import {useMemo} from "react";
import type {StrategicPlan,StrategicGoal,OperationalActivity,PerformanceIndicator} from "@/lib/institutional-planning";
import {assessPlanReadiness,type ReadinessCheck,type ReadinessTab} from "@/lib/plan-readiness";
type Props={
 plan:StrategicPlan;goals:StrategicGoal[];activities:OperationalActivity[];
 indicators:PerformanceIndicator[];onNavigate:(tab:ReadinessTab)=>void;
};
export default function PlanReadinessPanel({plan,goals,activities,indicators,onNavigate}:Props){
 const audit=useMemo(()=>assessPlanReadiness({plan,goals,activities,indicators}),
  [plan,goals,activities,indicators]);
 const ratio=Math.round(100*audit.mandatoryPassed/audit.mandatoryTotal);
 const coveredGoals=audit.goalCoverage.filter(row=>row.activityCount>0 && row.indicatorCount>0).length;
 const mandatory=audit.checks.filter(c=>c.required);
 const recommendations=audit.checks.filter(c=>!c.required);
 const item=(check:ReadinessCheck)=><li className="bosla-readiness-check" key={check.id}>
  <span className={check.passed?"good":"error"} aria-hidden="true">{check.passed?"✓":"!"}</span>
  <div><strong>{check.title}</strong><p>{check.detail}</p></div>
  {!check.passed&&<button className="secondary" type="button" onClick={()=>onNavigate(check.tab)}>فتح القسم</button>}
 </li>;
 return <section className="institutional-followup-panel bosla-readiness-panel" aria-label="فحص اكتمال الخطة">
  <h3>فحص اكتمال بيانات الخطة قبل الاعتماد</h3>
  <p className="muted">هذا فحص لوجود البيانات الأساسية وليس تقييمًا لجودة الخطة أو اعتمادًا إداريًا. الضوابط النهائية تُطبَّق أيضًا داخل قاعدة البيانات.</p>
  <div className="bosla-readiness-summary">
   <strong>{audit.mandatoryPassed} من {audit.mandatoryTotal}</strong>
   <span>متطلبات نشر مكتملة</span>
   <span>{ratio}%</span>
  </div>
  <div className="bosla-readiness-track" role="progressbar" aria-valuemin={0} aria-valuemax={audit.mandatoryTotal}
   aria-valuenow={audit.mandatoryPassed} aria-label="اكتمال متطلبات نشر الخطة">
   <span style={{width:ratio+"%"}}/>
  </div>
  {audit.canPublish?<p className="good">اكتملت حقول النشر الأساسية. قد تظل هناك توصيات لتحسين التنفيذ والقياس، والاعتماد الإداري خطوة مستقلة.</p>:
   <p className="error">يوجد {audit.mandatoryMissing} من متطلبات النشر الأساسية غير المكتملة. أكملها قبل محاولة الاعتماد النهائي.</p>}
  {audit.goalCoverage.length>0 && <details open={coveredGoals<audit.goalCoverage.length}>
   <summary>ربط الأهداف بالتنفيذ والقياس ({coveredGoals}/{audit.goalCoverage.length})</summary>
   <p>عدد الأهداف التي يرتبط بكل منها نشاط تشغيلي واحد على الأقل ومؤشر أداء واحد على الأقل.</p>
   <ul className="bosla-readiness-list">
    {audit.goalCoverage.map(({goal,activityCount,indicatorCount})=><li key={goal.id}>
     <strong>{goal.code} {goal.title}</strong>
     <p>الأنشطة المرتبطة: {activityCount} · مؤشرات الأداء المرتبطة: {indicatorCount}</p>
     {activityCount===0 && <button className="secondary" type="button" onClick={()=>onNavigate("activities")}>مراجعة الأنشطة</button>}
     {indicatorCount===0 && <button className="secondary" type="button" onClick={()=>onNavigate("indicators")}>مراجعة المؤشرات</button>}
    </li>)}
   </ul>
  </details>}
  <details open={audit.mandatoryMissing>0}>
   <summary>المتطلبات الأساسية ({audit.mandatoryPassed}/{audit.mandatoryTotal})</summary>
   <ul className="bosla-readiness-list">{mandatory.map(item)}</ul>
  </details>
  <details>
   <summary>توصيات استكمال الخطة ({audit.recommendationsPassed}/{audit.recommendationsTotal}) — لا تمنع النشر</summary>
   <ul className="bosla-readiness-list">{recommendations.map(item)}</ul>
  </details>
  <p className="muted">حقول المستهدفات والموازنات غير المدخلة تبقى فارغة، ولا تقوم المنصة بإنشاء أرقام افتراضية أو تفسير غياب القياس على أنه فشل في الإنجاز.</p>
 </section>;
}
