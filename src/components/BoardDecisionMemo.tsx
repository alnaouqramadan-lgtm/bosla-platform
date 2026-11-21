"use client";
import {boardDecisionMemo,criteria,readDesign} from "@/lib/strategy-design";
import type {StrategicPlan} from "@/lib/institutional-planning";

const statuses:Record<StrategicPlan["status"],string>={
 draft:"مسودة",in_review:"قيد المراجعة",reviewed:"تمت المراجعة وتنتظر الاعتماد",approved:"معتمدة"
};
export default function BoardDecisionMemo({plan,design}:{plan:StrategicPlan;design:unknown}){
 let memo;
 try{memo=boardDecisionMemo(readDesign(design));}
 catch{return <p className="card error" role="alert">تعذّر عرض مذكرة القرار. راجع سجل بناء الاستراتيجية.</p>;}
 if(!memo)return <p className="card">تظهر مذكرة مجلس الإدارة هنا بعد أن يحفظ الفريق توصيته في تبويب بناء الاستراتيجية.</p>;
 const {issue,selected,decision,alternatives,factors,weights}=memo;
 return <section dir="rtl" className="card board-decision-memo">
  <h2>مذكرة الاختيار الاستراتيجي لمجلس الإدارة</h2>
  <p><strong>{plan.title}</strong> · {plan.period_start} — {plan.period_end}</p>
  <p>حالة الخطة: {statuses[plan.status]}</p>
  <button className="secondary no-print" type="button" onClick={()=>window.print()}>طباعة المذكرة أو حفظ PDF</button>
  <h3>القضية المعروضة</h3><p>{issue.title}</p>
  <h3>توصية الفريق</h3><p><strong>{selected.title}</strong></p>
  <p>{decision.reason}</p>
  <p><strong>الافتراض المؤثر في القرار:</strong> {decision.assumption||"غير مسجل"}</p>
  <h3>البدائل المدروسة لهذه القضية</h3>
  <div className="bosla-report-table-wrap"><table>
   <thead><tr><th>البديل</th>{criteria.map((c,i)=><th key={c}>{c} (الوزن {weights[i]})</th>)}<th>الدرجة المرجحة / 5</th></tr></thead>
   <tbody>{alternatives.map(option=><tr key={option.id}><th scope="row">{option.title}{option.id===selected.id?" — موصى به":""}</th>
    {option.scores.map((v,i)=><td key={i}>{v}</td>)}<td>{option.score?.toFixed(2)??"غير محسوبة"}</td></tr>)}</tbody>
  </table></div>
  <h3>أدلة القضية والبديل الموصى به</h3>
  <ul>{factors.map(f=><li key={f.id}><strong>{f.statement}</strong> · {f.quadrant}
   <p>{f.method} · {f.category} · {f.source||"يحتاج إلى مصدر"}{f.date?" · "+f.date:""}</p>
  </li>)}</ul>
  {memo.missingFactors>0&&<p>عوامل مرتبطة تعذّر العثور عليها: {memo.missingFactors}</p>}
 </section>;
}
