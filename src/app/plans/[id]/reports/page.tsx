"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useParams,useRouter} from "next/navigation";
import Link from "next/link";
import {supabase} from "@/lib/supabase";
import {buildPeriodicReport,reportWindow,asOfCutoff,type ReportPeriod,type DeliveryFlag,type Attainment} from "@/lib/institutional-report";
import type {StrategicPlan,StrategicGoal,OperationalActivity,PerformanceIndicator} from "@/lib/institutional-planning";
import type {ActivityReport,KpiMeasurement} from "@/lib/progress-metrics";

const fmt=(value:number|null|undefined)=>value==null?"—":new Intl.NumberFormat("ar",{maximumFractionDigits:2}).format(value);
const textDate=(value:string|null|undefined)=>value||"—";
const errorText=(e:unknown)=>e instanceof Error?e.message:String(e);
const localToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
const status:Record<DeliveryFlag,string>={scheduled:"مجدول لاحقًا",completed:"مكتمل",blocked:"متعثر",
 overdue:"متأخر",in_progress:"قيد التنفيذ",unreported:"لا يوجد تقرير"};
const verdict:Record<Attainment,string>={met:"تحقق المستهدف",not_met:"دون المستهدف",unmeasured:"غير مقاس",
 unknown_direction:"اتجاه النجاح غير محدد"};
const monthNames=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const baseColumns="id,plan_id,organization_id";

async function fetchAll<T>(table:string,columns:string,planId:string,dateColumn:string,cutoff:string,from:string):Promise<T[]>{
 const rows:T[]=[];
 const batch=500;
 for(let offset=0;offset<50000;offset+=batch){
  const result=await supabase.from(table).select(columns).eq("plan_id",planId)
   .gte(dateColumn,from).lte(dateColumn,cutoff)
   .order("id",{ascending:true}).range(offset,offset+batch-1);
  if(result.error)throw result.error;
  const data=(result.data??[]) as T[];
  rows.push(...data);
  if(data.length<batch)return rows;
 }
 throw new Error("البيانات أكبر من حد استخراج التقرير. لا يمكن إصدار تقرير ناقص؛ يلزم تفعيل استخراج على دفعات من الخادم.");
}
export default function InstitutionalPeriodicReportPage(){
 const {id}=useParams<{id:string}>();
 const router=useRouter();
 const [plan,setPlan]=useState<StrategicPlan|null>(null);
 const [orgName,setOrgName]=useState("المؤسسة");
 const [goals,setGoals]=useState<StrategicGoal[]>([]);
 const [activities,setActivities]=useState<OperationalActivity[]>([]);
 const [indicators,setIndicators]=useState<PerformanceIndicator[]>([]);
 const [updates,setUpdates]=useState<ActivityReport[]>([]);
 const [measurements,setMeasurements]=useState<KpiMeasurement[]>([]);
 const [kind,setKind]=useState<ReportPeriod>("year");
 const [year,setYear]=useState(new Date().getFullYear());
 const [slot,setSlot]=useState(new Date().getMonth()+1);
 const [refresh,setRefresh]=useState(0);
 const [setupLoading,setSetupLoading]=useState(true);
 const [loading,setLoading]=useState(true);
 const [exporting,setExporting]=useState(false);
 const [error,setError]=useState("");
 const [sourceError,setSourceError]=useState("");

 useEffect(()=>{let alive=true;
  async function load(){
   setSetupLoading(true);setError("");
   try{
    const auth=await supabase.auth.getUser();
    if(auth.error)throw auth.error;
    if(!auth.data.user){router.replace("/login");return;}
    const root=await supabase.from("planning_strategic_plans")
     .select("id,organization_id,source_workshop_id,created_by,title,period_start,period_end,vision,mission,institutional_values,environmental_analysis,status,revision,created_at,updated_at")
     .eq("id",id).maybeSingle();
    if(root.error)throw root.error;
    if(!root.data)throw new Error("الخطة غير موجودة أو لا تملك صلاحية الاطلاع عليها.");
    const current=root.data as StrategicPlan;
    const [g,a,k,o]=await Promise.all([
     supabase.from("planning_strategic_goals")
      .select("id,plan_id,organization_id,code,title,description,strategic_axis,priority,sort_order")
      .eq("plan_id",id).order("sort_order"),
     supabase.from("planning_operational_activities")
      .select("id,plan_id,organization_id,goal_id,program_name,project_name,title,target_group,target_quantity,target_unit,owner_name,planned_start,planned_end,estimated_budget,currency_code,risk_notes,status")
      .eq("plan_id",id).order("created_at"),
     supabase.from("planning_performance_indicators")
      .select("id,plan_id,organization_id,goal_id,title,unit,baseline,target,verification_source,frequency,methodology")
      .eq("plan_id",id).order("created_at"),
     supabase.from("planning_organizations").select("name").eq("id",current.organization_id).maybeSingle()
    ]);
    for(const q of [g,a,k])if(q.error)throw q.error;
    if(!alive)return;
    setPlan(current);
    setGoals((g.data??[]) as StrategicGoal[]);
    setActivities((a.data??[]) as OperationalActivity[]);
    setIndicators((k.data??[]) as PerformanceIndicator[]);
    setOrgName(o.data?.name??"المؤسسة");
    setYear(y=>Math.min(Math.max(y,Number(current.period_start.slice(0,4))),Number(current.period_end.slice(0,4))));
   }catch(e){if(alive)setError(errorText(e));}
   finally{if(alive)setSetupLoading(false);}
  }
  void load();return()=>{alive=false;};
 },[id,router]);

 const windowInfo=useMemo(()=>reportWindow(kind,year,slot),[kind,year,slot]);
 const cutoff=plan?asOfCutoff(plan,windowInfo,localToday()):"";
 useEffect(()=>{if(!plan||plan.status!=="approved"){setLoading(false);return;}
  let alive=true;
  async function loadHistory(){
   setLoading(true);setSourceError("");
   try{
    const [a,k]=await Promise.all([
     fetchAll<ActivityReport>("planning_activity_progress",
      baseColumns+",activity_id,report_date,progress_percent,actual_quantity_to_date,spent_to_date,delivery_status,summary,evidence_reference,created_at",
      plan!.id,"report_date",cutoff,plan!.period_start),
     fetchAll<KpiMeasurement>("planning_kpi_measurements",
      baseColumns+",indicator_id,measured_on,actual_value,evidence_reference,notes,created_at",
      plan!.id,"measured_on",cutoff,plan!.period_start)
    ]);
    if(alive){setUpdates(a);setMeasurements(k);}
   }catch(e){if(alive)setSourceError(errorText(e));}
   finally{if(alive)setLoading(false);}
  }
  void loadHistory();return()=>{alive=false;};
 },[plan,cutoff,refresh]);
 const today=localToday();
 const report=useMemo(()=>plan&&plan.status==="approved"?buildPeriodicReport({
  plan,goals,activities,indicators,reports:updates,measurements,
  period:kind,year,slot,today
 }):null,[plan,goals,activities,indicators,updates,measurements,kind,year,slot,today]);
 const ready=report&&!loading&&!setupLoading&&!sourceError;
 const years=useMemo(()=>{
  if(!plan)return [year];
  const first=Number(plan.period_start.slice(0,4)),last=Number(plan.period_end.slice(0,4));
  return Array.from({length:Math.max(1,Math.min(last-first+1,300))},(_,i)=>first+i);
 },[plan,year]);
 async function download(){
  if(!plan||!ready||exporting||!report)return;
  setExporting(true);setError("");
  try{
   const {downloadPeriodReportXlsx}=await import("@/lib/institutional-report-export");
   await downloadPeriodReportXlsx(plan,orgName,report);
  }catch(e){setError(errorText(e));}finally{setExporting(false);}
 }
 return <main className="wrap institutional-app bosla-report-page" dir="rtl">
  <header className="institutional-hero no-print">
   <div><p className="institutional-kicker">BOSLA AI • التقارير المؤسسية</p>
    <h1>تقارير متابعة الخطة</h1>
    <p>مقارنة المخرجات الفعلية بالمستهدفات الموثقة — دون افتراض بيانات أو نتائج.</p></div>
   <Link className="chip" href={"/plans/"+id}>العودة إلى الخطة</Link>
  </header>
  {error&&<p role="alert" className="card error no-print">{error}</p>}
  {setupLoading&&<p className="card no-print" role="status">جارٍ جلب معلومات الخطة وصلاحيات العرض…</p>}
  {plan&&plan.status!=="approved"&&<section className="card no-print">
   <h2>التقرير متاح بعد الاعتماد النهائي</h2>
   <p>هذه الخطة لم تُعتمد نهائيًا بعد. يمكن إعداد المسودة ومراجعتها من صفحة الخطة، ثم إصدار تقرير متابعة مستند إلى خط الأساس المعتمد.</p>
  </section>}
  {plan?.status==="approved"&&<section className="card institutional-card no-print">
   <h2>إعداد التقرير</h2>
   <div className="institutional-form">
    <label>دورية التقرير
     <select className="field" value={kind} onChange={e=>{
      const next=e.target.value as ReportPeriod;setKind(next);
      if(next==="quarter")setSlot(Math.floor((new Date().getMonth())/3)+1);
      if(next==="month")setSlot(new Date().getMonth()+1);
     }}>
      <option value="month">شهري</option><option value="quarter">ربع سنوي</option><option value="year">سنوي</option>
     </select>
    </label>
    <label>السنة<select className="field" value={year} onChange={e=>setYear(Number(e.target.value))}>
     {years.map(y=><option key={y} value={y}>{y}</option>)}</select>
    </label>
    {kind!=="year"&&<label>الفترة
     <select className="field" value={slot} onChange={e=>setSlot(Number(e.target.value))}>
      {Array.from({length:kind==="quarter"?4:12},(_,i)=>i+1).map(i=>
       <option key={i} value={i}>{kind==="quarter"?"الربع "+i:monthNames[i-1]}</option>)}
     </select></label>}
    <div className="institutional-actions institutional-span">
     <button type="button" className="secondary" disabled={loading} onClick={()=>setRefresh(x=>x+1)}>تحديث القراءات</button>
     <button type="button" className="primary" disabled={!ready||exporting} onClick={()=>void download()}>
      {exporting?"جارٍ إعداد Excel…":"تصدير تقرير Excel"}</button>
     <button type="button" className="secondary" disabled={!ready} onClick={()=>window.print()}>
      طباعة التقرير / حفظ PDF</button>
    </div>
   </div>
   <p className="muted">يُحتسب الوضع التراكمي إلى تاريخ القطع، مع عدّ التحديثات الواقعة داخل الفترة المختارة فقط. التقرير يعكس القياسات المسجلة حاليًا حتى لو سُجلت بعض الوقائع بأثر رجعي.</p>
   {loading&&<p role="status" className="muted">جارٍ تحميل جميع القراءات المصرّح بعرضها…</p>}
   {sourceError&&<p role="alert" className="error">تعذّر إكمال تحميل بيانات القياس: {sourceError}. لن يُصدر تقرير جزئي.</p>}
  </section>}
  {ready&&report&&plan&&<section className="bosla-report-print" aria-label="تقرير متابعة الخطة">
   <header className="bosla-report-heading">
    <p>بوصلة AI | BOSLA AI • التخطيط والمتابعة المؤسسية</p>
    <h2>{report.window.label}</h2>
    <strong>{orgName}</strong>
    <p>{plan.title}</p>
    <p>فترة الخطة: {plan.period_start} — {plan.period_end} • الفترة المحددة: {report.window.start} — {report.window.end}</p>
    <p><strong>تاريخ قطع البيانات:</strong> {report.asOf}</p>
   </header>
   {!report.hasStarted&&<p className="bosla-report-warning">لم تبدأ فترة الخطة حتى تاريخ قطع التقرير. لا توجد نتائج فعلية لهذا النطاق.</p>}
   <h3>1. لوحة المؤشرات التنفيذية</h3>
   <div className="bosla-report-stats">
    <div><strong>{report.totals.activities}</strong><span>أنشطة الخطة</span></div>
    <div><strong>{report.totals.completed}</strong><span>مكتملة حتى تاريخ القطع</span></div>
    <div><strong>{report.totals.overdue}</strong><span>متأخرة وغير مكتملة</span></div>
    <div><strong>{report.totals.blocked}</strong><span>متعثر</span></div>
    <div><strong>{report.totals.scheduled}</strong><span>مجدولة لاحقًا</span></div>
    <div><strong>{report.totals.unreported}</strong><span>بلا تقرير</span></div>
    <div><strong>{report.totals.periodActivityUpdates}</strong><span>تحديثات الأنشطة داخل الفترة</span></div>
    <div><strong>{report.totals.periodKpiReadings}</strong><span>قراءات KPI داخل الفترة</span></div>
   </div>
   <p className="bosla-report-note">مؤشرات التقدم تعبّر عن حالة الأنشطة المسجلة، ولا تعني تلقائيًا تحقيق الأهداف الاستراتيجية أو الأثر.</p>
   <h3>2. متابعة أنشطة الخطة التشغيلية</h3>
   <div className="bosla-report-table-wrap"><table>
    <thead><tr><th>الهدف المرتبط</th><th>النشاط</th><th>المسؤول</th><th>موعد النهاية</th>
     <th>الكمية المستهدفة</th><th>الكمية الفعلية</th><th>الإنجاز</th><th>الحالة</th><th>آخر تقرير / دليل</th></tr></thead>
    <tbody>{report.activityLines.map(a=><tr key={a.id}>
     <td>{a.goalTitle}</td><td>{a.title}</td><td>{a.owner||"—"}</td><td>{textDate(a.end)}</td>
     <td>{fmt(a.target)} {a.unit}</td><td>{fmt(a.actualQuantity)} {a.unit}</td>
     <td>{a.progress==null?"—":fmt(a.progress)+"%"}</td><td>{status[a.flag]}</td>
     <td>{textDate(a.reportDate)}{a.reference&&<div className="bosla-report-evidence">{a.reference}</div>}</td>
    </tr>)}</tbody>
   </table></div>
   {!report.activityLines.length&&<p className="bosla-report-note">لا توجد أنشطة ضمن هذه الخطة.</p>}
   <h3>3. قياسات مؤشرات الأداء الاستراتيجي</h3>
   <p className="bosla-report-note">المقارنة تحترم اتجاه المؤشر فقط إذا كان خط الأساس والمستهدف مختلفين؛ وإلا لا يُصدر حكم آلي بالنجاح.</p>
   <div className="bosla-report-table-wrap"><table>
    <thead><tr><th>الهدف</th><th>المؤشر</th><th>خط الأساس</th><th>المستهدف</th>
     <th>الفعلي</th><th>الفارق</th><th>الحكم</th><th>آخر قياس / مصدر</th></tr></thead>
    <tbody>{report.indicatorLines.map(k=><tr key={k.id}>
     <td>{k.goalTitle}</td><td>{k.title} {k.unit&&<small>({k.unit})</small>}</td>
     <td>{fmt(k.baseline)}</td><td>{fmt(k.target)}</td><td>{fmt(k.actual)}</td>
     <td>{fmt(k.gap)}</td><td>{verdict[k.attainment]}</td>
     <td>{textDate(k.measuredOn)}{k.reference&&<div className="bosla-report-evidence">{k.reference}</div>}</td>
    </tr>)}</tbody>
   </table></div>
   {!report.indicatorLines.length&&<p className="bosla-report-note">لا توجد مؤشرات أداء ضمن هذه الخطة.</p>}
   <h3>4. الوضع المالي بحسب العملة</h3>
   <p className="bosla-report-note">التقديرات المعروضة لأنشطة الخطة الكاملة، بينما المصروفات تراكمية موثقة حتى تاريخ القطع؛ ليست موازنة خاصة بالفترة. لا تُجمع عملات مختلفة.</p>
   <div className="bosla-report-table-wrap"><table>
    <thead><tr><th>العملة</th><th>الموازنة المسجلة</th><th>المنصرف الموثق</th>
     <th>الفرق عند اكتمال البيانات</th><th>أنشطة بلا موازنة</th><th>أنشطة بلا صرف موثق</th></tr></thead>
    <tbody>{report.currencies.map(c=><tr key={c.currency}>
     <td>{c.currency}</td><td>{fmt(c.planned)}</td><td>{fmt(c.spent)}</td>
     <td>{fmt(c.variance)}</td><td>{c.missingPlanned}</td><td>{c.missingSpent}</td>
    </tr>)}</tbody>
   </table></div>
   <h3>5. ملاحظات تفسيرية ومنهجية</h3>
   <p className="bosla-report-note">لا يُستبدل القياس الغائب بصفر، ولا تُجمع قيم التقارير التراكمية المتكررة. يُختار آخر تقرير لكل نشاط ومؤشر بحسب تاريخ الواقعة حتى تاريخ القطع، ثم وقت الإدخال عند التساوي. القياسات المسجلة لاحقًا بتاريخ سابق قد تغيّر تقرير فترة سابقة عند إعادة إصداره. يتطلب الاستنتاج النهائي للأثر تحليلًا مستقلًا مع أدلة داعمة.</p>
   <footer className="bosla-report-foot">BOSLA AI • تقرير مولّد من السجلات المتاحة لمستخدم مخوّل بالعرض • هذا التقرير لا يُنشئ اعتمادًا إداريًا جديدًا.</footer>
  </section>}
 </main>;
}
