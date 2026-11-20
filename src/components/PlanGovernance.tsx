"use client";
import {useCallback,useEffect,useMemo,useState,type FormEvent} from "react";
import {supabase} from "@/lib/supabase";
import type {StrategicPlan,OperationalActivity,PerformanceIndicator} from "@/lib/institutional-planning";
import {deliveryOverview,latestById,type ActivityReport,type KpiMeasurement,type PlanRevision} from "@/lib/progress-metrics";

const err=(value:unknown)=>value instanceof Error?value.message:String(value);
const fmt=(value:number|null|undefined)=>value==null?"—":new Intl.NumberFormat("ar",{maximumFractionDigits:2}).format(value);
const today=()=>new Date().toLocaleDateString("en-CA");
type Props={plan:StrategicPlan;activities:OperationalActivity[];indicators:PerformanceIndicator[];onReload:()=>Promise<void>;canManage:boolean};

export default function PlanGovernance({plan,activities,indicators,onReload,canManage}:Props){
 const [revision,setRevision]=useState<PlanRevision|null>(null);
 const [activityReports,setActivityReports]=useState<ActivityReport[]>([]);
 const [kpiMeasurements,setKpiMeasurements]=useState<KpiMeasurement[]>([]);
 const [activityId,setActivityId]=useState("");
 const [indicatorId,setIndicatorId]=useState("");
 const [reportDate,setReportDate]=useState(today);
 const [percent,setPercent]=useState("0");
 const [quantity,setQuantity]=useState("");
 const [spent,setSpent]=useState("");
 const [deliveryStatus,setDeliveryStatus]=useState<ActivityReport["delivery_status"]>("in_progress");
 const [reportSummary,setReportSummary]=useState("");
 const [activityEvidence,setActivityEvidence]=useState("");
 const [measureDate,setMeasureDate]=useState(today);
 const [value,setValue]=useState("");
 const [kpiEvidence,setKpiEvidence]=useState("");
 const [notes,setNotes]=useState("");
 const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");

 const refresh=useCallback(async()=>{
  if(plan.status!=="approved")return;
  setLoading(true);
  try{
   const [versions,reports,measurements]=await Promise.all([
    supabase.from("planning_plan_revisions")
     .select("id,plan_id,organization_id,version,approved_at,approved_by,snapshot")
     .eq("plan_id",plan.id).order("version",{ascending:false}).limit(1),
    supabase.from("planning_activity_progress")
     .select("id,organization_id,plan_id,activity_id,report_date,progress_percent,actual_quantity_to_date,spent_to_date,delivery_status,summary,evidence_reference,created_at")
     .eq("plan_id",plan.id).order("created_at",{ascending:false}),
    supabase.from("planning_kpi_measurements")
     .select("id,organization_id,plan_id,indicator_id,measured_on,actual_value,evidence_reference,notes,created_at")
     .eq("plan_id",plan.id).order("created_at",{ascending:false})
   ]);
   for(const r of [versions,reports,measurements])if(r.error)throw r.error;
   setRevision((versions.data?.[0]??null) as PlanRevision|null);
   setActivityReports((reports.data??[]) as ActivityReport[]);
   setKpiMeasurements((measurements.data??[]) as KpiMeasurement[]);
  }catch(e){setError(err(e));}
  finally{setLoading(false);}
 },[plan.id,plan.status]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{setActivityId(old=>activities.some(a=>a.id===old)?old:activities[0]?.id??"");},[activities]);
 useEffect(()=>{setIndicatorId(old=>indicators.some(k=>k.id===old)?old:indicators[0]?.id??"");},[indicators]);
 const latestReports=useMemo(()=>latestById(activityReports,a=>a.activity_id,a=>a.report_date),[activityReports]);
 const latestKpis=useMemo(()=>latestById(kpiMeasurements,k=>k.indicator_id,k=>k.measured_on),[kpiMeasurements]);
 const counts=useMemo(()=>deliveryOverview(activities,activityReports,today()),[activities,activityReports]);

 async function publish(){
  if(busy||!canManage||plan.status!=="draft")return;
  if(!window.confirm("سيعتمد مالك المؤسسة الخطة ويُنشئ نسخة مرجعية ثابتة. لن تتمكن من تعديل هذه النسخة بعد الاعتماد. هل أنت متأكد؟"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await supabase.rpc("planning_publish_plan",{p_plan:plan.id});
   if(result.error)throw result.error;
   await onReload();setNotice("تم اعتماد الخطة بواسطة مالك المؤسسة وحفظ نسخة مرجعية غير قابلة للتعديل.");
  }catch(e){setError(err(e));}finally{setBusy(false);}
 }
 async function saveReport(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!canManage||plan.status!=="approved")return;
  setBusy(true);setError("");setNotice("");
  try{
   const progress=Number(percent),actual=quantity.trim()===""?null:Number(quantity),
    spentValue=spent.trim()===""?null:Number(spent);
   if(!Number.isFinite(progress)||progress<0||progress>100)throw new Error("أدخل نسبة إنجاز من صفر إلى 100.");
   if((actual!=null&&(!Number.isFinite(actual)||actual<0))||
    (spentValue!=null&&(!Number.isFinite(spentValue)||spentValue<0)))throw new Error("القيم التراكمية لا يمكن أن تكون سالبة.");
   if(deliveryStatus==="completed"&&progress!==100)throw new Error("النشاط المكتمل يجب أن تكون نسبة إنجازه 100%.");
   if(activityEvidence.trim().length<3)throw new Error("اكتب رقم المستند أو رابط دليل الإنجاز.");
   if(!activities.some(a=>a.id===activityId))throw new Error("اختر نشاطًا موجودًا ضمن الخطة.");
   const data={organization_id:plan.organization_id,plan_id:plan.id,activity_id:activityId,
    report_date:reportDate,progress_percent:progress,actual_quantity_to_date:actual,
    spent_to_date:spentValue,delivery_status:deliveryStatus,summary:reportSummary,
    evidence_reference:activityEvidence.trim()};
   const result=await supabase.from("planning_activity_progress").insert(data).select("id").single();
   if(result.error)throw result.error;
   setNotice("حُفظ تقرير التقدم بنجاح، وسيبقى في سجل التحديثات دون استبدال التقارير السابقة.");
   setReportSummary("");setActivityEvidence("");await refresh();
  }catch(e){setError(err(e));}finally{setBusy(false);}
 }
 async function saveMeasurement(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!canManage||plan.status!=="approved")return;
  setBusy(true);setError("");setNotice("");
  try{
   const actual=Number(value);
   if(!value.trim()||!Number.isFinite(actual))throw new Error("أدخل القيمة المقاسة للمؤشر.");
   if(kpiEvidence.trim().length<3)throw new Error("أدخل مصدر التحقق أو مرجع المستند.");
   if(!indicators.some(k=>k.id===indicatorId))throw new Error("اختر مؤشرًا من الخطة.");
   const result=await supabase.from("planning_kpi_measurements").insert({
    organization_id:plan.organization_id,plan_id:plan.id,indicator_id:indicatorId,
    measured_on:measureDate,actual_value:actual,evidence_reference:kpiEvidence.trim(),notes
   }).select("id").single();
   if(result.error)throw result.error;
   setNotice("سُجلت قراءة مؤشر الأداء وأضيفت إلى سجله التاريخي.");
   setValue("");setKpiEvidence("");setNotes("");await refresh();
  }catch(e){setError(err(e));}finally{setBusy(false);}
 }
 return <section className="card institutional-card">
  <h2>اعتماد الخطة ومتابعة الإنجاز</h2>
  {error&&<p role="alert" className="error">{error}</p>}
  {notice&&<p role="status" className="good">{notice}</p>}
  {plan.status==="draft"?<div className="stack">
   <p>مرحلة إعداد الخطة: يراجع مالك المؤسسة الرؤية والرسالة والأهداف والأنشطة والمؤشرات قبل اعتماد خط أساس رسمي.</p>
   <p className="muted">للاعتماد يلزم هدف واحد، ونشاط تشغيلي واحد، ومؤشر أداء واحد على الأقل، مع مستهدف ومصدر تحقق لكل مؤشر، ورؤية ورسالة مكتوبتين.</p>
   <p className="muted">الاعتماد الحالي ينفذه <strong>مالك المؤسسة</strong> بصفته المسؤول الإداري في النسخة الأولية. ليس اعتمادًا من مجلس الإدارة أو لجنة مستقلة؛ سنضيف مستويات الاعتماد والصلاحيات في مرحلة لاحقة.</p>
   {canManage&&<button className="primary" type="button" disabled={busy||!activities.length||!indicators.length}
    onClick={()=>void publish()}>{busy?"جارٍ الاعتماد…":"اعتماد الخطة ونشر النسخة المرجعية"}</button>}
   </div>:<>
   <p className="good">الخطة معتمدة بواسطة مالك المؤسسة. حقول الخطة الأساسية مُقفلة، ويُسمح بتسجيل تحديثات الإنجاز.</p>
   {loading&&<p role="status" className="muted">جارٍ تحميل بيانات المتابعة…</p>}
   {revision?<p className="muted">النسخة المعتمدة: {revision.version} • تاريخ الاعتماد: {new Date(revision.approved_at).toLocaleString("ar")} • محفوظة كلقطة بيانات ثابتة.</p>:<p className="error">تعذّر العثور على سجل النسخة المعتمدة؛ راجع سجل قاعدة البيانات.</p>}
   <div className="institutional-metrics">
    <div><strong>{counts.total}</strong><small>أنشطة بالخطة</small></div>
    <div><strong>{counts.withReports}</strong><small>أنشطة لها تقارير</small></div>
    <div><strong>{counts.completed}</strong><small>أنشطة مكتملة (100%)</small></div>
    <div><strong>{counts.overdue}</strong><small>أنشطة تجاوزت موعدها ولم تكتمل</small></div>
   </div>
   <p className="muted">العدد المكتمل لا يمثل نسبة تحقيق الأهداف الاستراتيجية أو مؤشرات الأثر. أي قيمة فعلية هنا مصدرها تقرير مسجل فقط، دون افتراض أن النشاط المنفذ يساوي هدفًا متحققًا.</p>
   {!canManage&&<p className="muted">صلاحية حسابك: مشاهدة الخطة المعتمدة ونتائج المتابعة فقط. لا يمكنك اعتماد الخطة أو تسجيل إنجازات جديدة.</p>}
   {canManage&&<div className="institutional-followup-grid">
    <div className="institutional-followup-panel">
     <h3>تحديث تنفيذ نشاط</h3>
     <form className="stack" onSubmit={saveReport}>
      <label>النشاط<select className="field" required value={activityId} onChange={e=>setActivityId(e.target.value)}>
       {activities.map(a=><option value={a.id} key={a.id}>{a.title}</option>)}
      </select></label>
      <label>تاريخ التقرير<input className="field" type="date" required max={today()} value={reportDate} onChange={e=>setReportDate(e.target.value)}/></label>
      <label>نسبة إنجاز النشاط (%)<input className="field" type="number" min="0" max="100" step="0.01" required value={percent} onChange={e=>setPercent(e.target.value)}/></label>
      <label>الحالة<select className="field" value={deliveryStatus} onChange={e=>setDeliveryStatus(e.target.value as ActivityReport["delivery_status"])}>
       <option value="in_progress">قيد التنفيذ</option><option value="completed">مكتمل</option><option value="blocked">متعثر</option>
      </select></label>
      <label>عدد المستفيدين/الوحدات المحقق تراكميًا<input type="number" min="0" step="0.01" className="field" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
      <label>المصروف التراكمي (بنفس عملة النشاط)<input type="number" min="0" step="0.01" className="field" value={spent} onChange={e=>setSpent(e.target.value)}/></label>
      <label>وصف ما أُنجز<textarea className="field" rows={3} value={reportSummary} onChange={e=>setReportSummary(e.target.value)}/></label>
      <label>مرجع الدليل أو التقرير<input className="field" required minLength={3} maxLength={500} value={activityEvidence} onChange={e=>setActivityEvidence(e.target.value)} placeholder="رقم تقرير، محضر، أو رابط مستند"/></label>
      <button className="primary" disabled={busy||!activityId}>حفظ تقرير الإنجاز</button>
     </form>
    </div>
    <div className="institutional-followup-panel">
     <h3>إدخال قراءة مؤشر الأداء</h3>
     <form className="stack" onSubmit={saveMeasurement}>
      <label>المؤشر<select className="field" required value={indicatorId} onChange={e=>setIndicatorId(e.target.value)}>
       {indicators.map(k=><option value={k.id} key={k.id}>{k.title}</option>)}
      </select></label>
      <label>تاريخ القياس<input type="date" className="field" required max={today()} value={measureDate} onChange={e=>setMeasureDate(e.target.value)}/></label>
      <label>القيمة الفعلية المقاسة<input className="field" required type="number" step="any" value={value} onChange={e=>setValue(e.target.value)}/></label>
      <label>مصدر التحقق<input className="field" required minLength={3} maxLength={500} value={kpiEvidence} onChange={e=>setKpiEvidence(e.target.value)} placeholder="رقم استبيان، تقرير أو رابط مستند"/></label>
      <label>ملاحظات القراءة<textarea className="field" rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      <button className="primary" disabled={busy||!indicatorId}>تسجيل قياس المؤشر</button>
     </form>
    </div>
   </div>}
   <h3>حالة تنفيذ الأنشطة</h3>
   <div className="institutional-records">{activities.map(a=>{
    const current=latestReports.get(a.id);
    return <article className="institutional-record" key={a.id}>
     <div><strong>{a.title}</strong><p>المسؤول: {a.owner_name||"غير محدد"} • الموعد: {a.planned_end||"غير محدد"}</p>
      <p>آخر تقدم مسجل: {current?fmt(current.progress_percent)+"%":"لا يوجد تقرير"}
       {current&&" • كمية فعلية تراكمية: "+fmt(current.actual_quantity_to_date)+" • مصروف تراكمي: "+fmt(current.spent_to_date)+" "+a.currency_code}</p>
      {current&&<small>تاريخ التقرير: {current.report_date} • الدليل: {current.evidence_reference}</small>}</div>
     </article>;
   })}</div>
   <h3>نتائج مؤشرات الأداء</h3>
   <div className="institutional-records">{indicators.map(k=>{
    const current=latestKpis.get(k.id);
    return <article className="institutional-record" key={k.id}><div>
     <strong>{k.title}</strong><p>خط الأساس: {fmt(k.baseline)} • المستهدف: {fmt(k.target)} {k.unit}</p>
     <p>القراءة الفعلية: {current?fmt(current.actual_value)+" "+k.unit:"لم تُسجل بعد"}</p>
     {current&&<small>تاريخ القياس: {current.measured_on} • مصدر التحقق: {current.evidence_reference}</small>}
    </div></article>;
   })}</div>
   <details><summary>سجل تحديثات التنفيذ ({activityReports.length})</summary>
    <div className="institutional-records">{activityReports.map(r=><article key={r.id} className="institutional-record"><div>
     <strong>{activities.find(a=>a.id===r.activity_id)?.title||"نشاط غير متاح"}</strong>
     <p>{r.report_date} • إنجاز {fmt(r.progress_percent)}% • {r.delivery_status==="completed"?"مكتمل":r.delivery_status==="blocked"?"متعثر":"قيد التنفيذ"}</p>
     <p>{r.summary}</p><small>مرجع: {r.evidence_reference}</small>
    </div></article>)}</div>
   </details>
   <details><summary>سجل قياسات مؤشرات الأداء ({kpiMeasurements.length})</summary>
    <div className="institutional-records">{kpiMeasurements.map(r=><article key={r.id} className="institutional-record"><div>
     <strong>{indicators.find(k=>k.id===r.indicator_id)?.title||"مؤشر غير متاح"}</strong>
     <p>{r.measured_on} • قيمة فعلية: {fmt(r.actual_value)}</p>
     <p>{r.notes}</p><small>مرجع: {r.evidence_reference}</small>
    </div></article>)}</div>
   </details>
   <button type="button" className="secondary" disabled={busy||loading} onClick={()=>void refresh()}>تحديث بيانات المتابعة</button>
  </>}
 </section>;
}
