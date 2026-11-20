import type {Workshop} from "@/lib/types";
import type {FormReview} from "@/lib/form-review";
import {STAGES} from "@/lib/stages";
import {approvedValue,worksheetData} from "@/lib/worksheet-model";

type Props={workshop:Workshop;reviews:FormReview[]};
const blank=(s:string)=>s||"____________________________";
export default function WorkshopPrintReport({workshop,reviews}:Props){
  const data=worksheetData(reviews);
  const title=(stage:number,headline:string,subline:string)=><header className="worksheet-head">
    <div className="worksheet-identity">
      <span>ورشة التخطيط التشاركي {workshop.planning_year}</span>
      <strong>{workshop.title}</strong>
    </div>
    <div className="worksheet-heading"><h2>{headline}</h2><p>{subline}</p></div>
    <div className="worksheet-number">ورقة عمل ({stage})</div>
  </header>;
  const members=<div className="worksheet-members">
    <span>رقم المجموعة: ( ____ )</span><span>أعضاء المجموعة: 1. ____________ 2. ____________ 3. ____________</span>
  </div>;
  const panel=(heading:string,body:string,tone:string)=><div className={"worksheet-panel "+tone}>
    <h3>{heading}</h3><p>{blank(body)}</p>
  </div>;
  return <div className="worksheet-print-report" dir="rtl" aria-label="النماذج الرسمية للطباعة">
    {STAGES.slice(0,3).map((stage,i)=><section className="worksheet-page" key={i}>
      {title(i+1,stage.name,stage.description)}
      {members}
      <h3 className="worksheet-table-title">مخرجات ورقة العمل ({i+1})</h3>
      <table className="worksheet-table"><thead><tr><th>المحور</th><th>الصياغة المعتمدة</th></tr></thead>
      <tbody>{stage.fields.map(field=><tr key={field.key}><td>{field.title}</td>
        <td>{blank(approvedValue(reviews,i+1,field.key))}</td></tr>)}</tbody></table>
      <p className="worksheet-footnote">يظهر هنا النص المعتمد نهائيًا فقط، ولا تُعرض المسودات أو المقترحات بوصفها قرارات.</p>
    </section>)}
    <section className="worksheet-page">
      {title(4,"كيف سنحقق أهدافنا؟","تحديد البرامج والمشاريع والأنشطة لتنفيذ الأهداف")}
      {members}
      <h3 className="worksheet-table-title">الخطة التنفيذية المقترحة لعام {workshop.planning_year}</h3>
      <table className="worksheet-table">
        <thead><tr><th>رقم</th><th>المشروع / النشاط</th><th>الهدف المرتبط</th>
        <th>الفئة المستهدفة</th><th>الكمية المستهدفة</th><th>فترة التنفيذ</th>
        <th>المسؤول</th><th>التكلفة التقديرية</th></tr></thead>
        <tbody>{data.activities.map(row=><tr key={row.number}><td>{row.number}</td><td>{row.project}</td>
          <td>{row.goal}</td><td>{row.audience}</td><td>{row.quantity}</td>
          <td>{row.period}</td><td>{row.responsible}</td><td>{row.estimatedCost}</td></tr>)}</tbody>
      </table>
      <div className="worksheet-panels">
        {panel("متطلبات النجاح",data.implementationNeeds,"purple")}
        {panel("المخاطر المحتملة",data.risks,"gold")}
        {panel("مؤشرات التنفيذ والمتابعة",data.implementationMonitoring,"green")}
      </div>
      <p className="worksheet-priority">أهم 3 أنشطة ذات أولوية: 1. _____________ 2. _____________ 3. _____________</p>
      <p className="worksheet-footnote">{data.dataNote}</p>
    </section>
    <section className="worksheet-page">
      {title(5,"كيف نعرف أننا نجحنا؟","تحديد مؤشرات الأداء وقياس النتائج")}
      {members}
      <h3 className="worksheet-table-title">مؤشرات النجاح لأهدافنا لعام {workshop.planning_year}</h3>
      <table className="worksheet-table">
        <thead><tr><th>رقم</th><th>الهدف</th><th>مؤشر الأداء</th><th>خط الأساس</th>
          <th>المستهدف {workshop.planning_year}</th><th>مصدر التحقق</th><th>دورية القياس</th></tr></thead>
        <tbody>{data.indicators.map(row=><tr key={row.number}><td>{row.number}</td>
          <td>{row.goal}</td><td>{row.indicator}</td><td>{row.baseline}</td>
          <td>{row.target}</td><td>{row.verification}</td><td>{row.frequency}</td></tr>)}</tbody>
      </table>
      <div className="worksheet-panels">
        {panel("آلية المتابعة والتقييم",data.evaluation,"purple")}
        {panel("معايير الحكم على النجاح",data.successCriteria,"gold")}
        {panel("النتائج المتوقعة والأثر",data.expectedResults,"green")}
      </div>
      <p className="worksheet-priority">أهم 3 مؤشرات رئيسية للمتابعة المؤسسية: 1. _____________ 2. _____________ 3. _____________</p>
      <p className="worksheet-footnote">{data.dataNote}</p>
    </section>
  </div>;
}
