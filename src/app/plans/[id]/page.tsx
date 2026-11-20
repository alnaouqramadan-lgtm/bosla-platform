"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {useParams,useRouter} from "next/navigation";
import Link from "next/link";
import {supabase} from "@/lib/supabase";
import {
 optionalNonnegative,optionalNumber,splitApprovedGoals,validatePlanPeriod,frequencyLabels,
 type StrategicPlan,type StrategicGoal,type OperationalActivity,type PerformanceIndicator
} from "@/lib/institutional-planning";

const err=(e:unknown)=>e instanceof Error?e.message:String(e);
const n=(value:number|null|undefined)=>value==null?"—":new Intl.NumberFormat("ar").format(value);
const emptyActivity={goal_id:"",title:"",program_name:"",project_name:"",target_group:"",
 target_quantity:"",target_unit:"",owner_name:"",planned_start:"",planned_end:"",
 estimated_budget:"",currency_code:"ILS" as OperationalActivity["currency_code"],risk_notes:""};
const emptyKpi={goal_id:"",title:"",unit:"",baseline:"",target:"",
 verification_source:"",frequency:"quarterly" as PerformanceIndicator["frequency"],methodology:""};
type Section="vision"|"goals"|"activities"|"indicators";
export default function InstitutionalPlan(){
 const {id}=useParams<{id:string}>();const router=useRouter();
 const [plan,setPlan]=useState<StrategicPlan|null>(null);
 const [goals,setGoals]=useState<StrategicGoal[]>([]);
 const [activities,setActivities]=useState<OperationalActivity[]>([]);
 const [indicators,setIndicators]=useState<PerformanceIndicator[]>([]);
 const [draft,setDraft]=useState({vision:"",mission:"",institutional_values:"",environmental_analysis:""});
 const [goal,setGoal]=useState({title:"",description:"",strategic_axis:"",code:"",priority:3});
 const [activity,setActivity]=useState({...emptyActivity});
 const [kpi,setKpi]=useState({...emptyKpi});
 const [editingGoalId,setEditingGoalId]=useState("");
 const [editingActivityId,setEditingActivityId]=useState("");
 const [editingKpiId,setEditingKpiId]=useState("");
 const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [active,setActive]=useState<Section>("vision");
 const load=useCallback(async()=>{
  const auth=await supabase.auth.getUser();
  if(auth.error)throw auth.error;
  if(!auth.data.user){router.replace("/login");return;}
  const root=await supabase.from("planning_strategic_plans")
   .select("id,organization_id,source_workshop_id,created_by,title,period_start,period_end,vision,mission,institutional_values,environmental_analysis,status,revision,created_at,updated_at")
   .eq("id",id).maybeSingle();
  if(root.error)throw root.error;
  if(!root.data){setPlan(null);return;}
  const current=root.data as StrategicPlan;
  const [goalsRes,activityRes,indicatorRes]=await Promise.all([
   supabase.from("planning_strategic_goals").select("id,plan_id,organization_id,code,title,description,strategic_axis,priority,sort_order")
    .eq("plan_id",id).order("sort_order").order("created_at"),
   supabase.from("planning_operational_activities").select("id,plan_id,organization_id,goal_id,program_name,project_name,title,target_group,target_quantity,target_unit,owner_name,planned_start,planned_end,estimated_budget,currency_code,risk_notes,status")
    .eq("plan_id",id).order("created_at"),
   supabase.from("planning_performance_indicators").select("id,plan_id,organization_id,goal_id,title,unit,baseline,target,verification_source,frequency,methodology")
    .eq("plan_id",id).order("created_at")
  ]);
  for(const result of [goalsRes,activityRes,indicatorRes])if(result.error)throw result.error;
  setPlan(current);
  setDraft({vision:current.vision,mission:current.mission,institutional_values:current.institutional_values,
   environmental_analysis:current.environmental_analysis});
  const list=(goalsRes.data??[]) as StrategicGoal[];
  setGoals(list);setActivities((activityRes.data??[]) as OperationalActivity[]);
  setIndicators((indicatorRes.data??[]) as PerformanceIndicator[]);
  setActivity(prev=>({...prev,goal_id:list.some(g=>g.id===prev.goal_id)?prev.goal_id:list[0]?.id??""}));
  setKpi(prev=>({...prev,goal_id:list.some(g=>g.id===prev.goal_id)?prev.goal_id:list[0]?.id??""}));
 },[id,router]);
 useEffect(()=>{let mounted=true;load().catch(e=>{if(mounted)setError(err(e));})
  .finally(()=>{if(mounted)setLoading(false);});return()=>{mounted=false;};},[load]);

 async function action(run:()=>Promise<string>){
  if(!plan||busy)return;
  setBusy(true);setError("");setNotice("");
  try{const success=await run();await load();setNotice(success);}
  catch(e){setError(err(e));}
  finally{setBusy(false);}
 }
 function saveDirection(e:FormEvent){e.preventDefault();
  void action(async()=>{
   const x=await supabase.from("planning_strategic_plans").update(draft).eq("id",id).eq("organization_id",plan!.organization_id)
    .select("id").single();
   if(x.error)throw x.error;
   return "حُفظت الرؤية والرسالة والتحليل المؤسسي في مسودة الخطة.";
  });
 }
 function createGoal(e:FormEvent){e.preventDefault();
  void action(async()=>{
   const data={...goal,title:goal.title.trim()};
   const x=editingGoalId
    ?await supabase.from("planning_strategic_goals").update(data)
     .eq("id",editingGoalId).eq("plan_id",id).select("id").single()
    :await supabase.from("planning_strategic_goals").insert({
     ...data,organization_id:plan!.organization_id,plan_id:id,sort_order:goals.length
    }).select("id").single();
   if(x.error)throw x.error;
   setGoal({title:"",description:"",strategic_axis:"",code:"",priority:3});
   setEditingGoalId("");
   return editingGoalId?"تم تحديث الهدف الاستراتيجي.":"تمت إضافة الهدف الاستراتيجي.";
  });
 }
 function createActivity(e:FormEvent){e.preventDefault();
  void action(async()=>{
   const data={
    organization_id:plan!.organization_id,plan_id:id,
    goal_id:activity.goal_id,title:activity.title.trim(),program_name:activity.program_name,
    project_name:activity.project_name,target_group:activity.target_group,
    target_quantity:optionalNonnegative(activity.target_quantity),target_unit:activity.target_unit,
    owner_name:activity.owner_name,planned_start:activity.planned_start||null,
    planned_end:activity.planned_end||null,estimated_budget:optionalNonnegative(activity.estimated_budget),
    currency_code:activity.currency_code,risk_notes:activity.risk_notes
   };
   if(data.planned_start&&data.planned_end)validatePlanPeriod(data.planned_start,data.planned_end);
   const x=editingActivityId
    ?await supabase.from("planning_operational_activities").update(data)
      .eq("id",editingActivityId).eq("plan_id",id).select("id").single()
    :await supabase.from("planning_operational_activities").insert(data).select("id").single();
   if(x.error)throw x.error;
   setActivity({...emptyActivity,goal_id:activity.goal_id});
   setEditingActivityId("");
   return editingActivityId?"تم تحديث النشاط التشغيلي.":"تمت إضافة النشاط التشغيلي وربطه بهدفه.";
  });
 }
 function createKpi(e:FormEvent){e.preventDefault();
  void action(async()=>{
   const data={goal_id:kpi.goal_id,title:kpi.title.trim(),
    unit:kpi.unit,baseline:optionalNumber(kpi.baseline),target:optionalNumber(kpi.target),
    verification_source:kpi.verification_source,frequency:kpi.frequency,methodology:kpi.methodology};
   const x=editingKpiId
    ?await supabase.from("planning_performance_indicators").update(data)
      .eq("id",editingKpiId).eq("plan_id",id).select("id").single()
    :await supabase.from("planning_performance_indicators").insert({
     ...data,organization_id:plan!.organization_id,plan_id:id
    }).select("id").single();
   if(x.error)throw x.error;
   setKpi({...emptyKpi,goal_id:kpi.goal_id});
   setEditingKpiId("");
   return editingKpiId?"تم تحديث مؤشر الأداء.":"تمت إضافة مؤشر الأداء المرتبط بهدفه.";
  });
 }
 function beginGoalEdit(g:StrategicGoal){
  setEditingGoalId(g.id);setGoal({title:g.title,description:g.description,
   strategic_axis:g.strategic_axis,code:g.code,priority:g.priority});setError("");
 }
 function beginActivityEdit(a:OperationalActivity){
  setEditingActivityId(a.id);
  setActivity({goal_id:a.goal_id,title:a.title,program_name:a.program_name,
   project_name:a.project_name,target_group:a.target_group,
   target_quantity:a.target_quantity==null?"":String(a.target_quantity),target_unit:a.target_unit,
   owner_name:a.owner_name,planned_start:a.planned_start??"",planned_end:a.planned_end??"",
   estimated_budget:a.estimated_budget==null?"":String(a.estimated_budget),
   currency_code:a.currency_code,risk_notes:a.risk_notes});
  setError("");
 }
 function beginKpiEdit(k:PerformanceIndicator){
  setEditingKpiId(k.id);
  setKpi({goal_id:k.goal_id,title:k.title,unit:k.unit,
   baseline:k.baseline==null?"":String(k.baseline),
   target:k.target==null?"":String(k.target),
   verification_source:k.verification_source,frequency:k.frequency,methodology:k.methodology});
  setError("");
 }
 async function remove(kind:"goal"|"activity"|"indicator",rowId:string){
  const table=kind==="goal"?"planning_strategic_goals":kind==="activity"?"planning_operational_activities":"planning_performance_indicators";
  if(kind==="goal"&&(activities.some(a=>a.goal_id===rowId)||indicators.some(k=>k.goal_id===rowId))){
   setError("الهدف مرتبط بأنشطة أو مؤشرات. احذف الروابط أولًا قبل حذف الهدف.");return;
  }
  if(!window.confirm("هل تريد حذف هذا السجل نهائيًا من مسودة الخطة؟"))return;
  await action(async()=>{
   const result=await supabase.from(table).delete().eq("id",rowId).eq("plan_id",id).select("id").single();
   if(result.error)throw result.error;
   return "حُذف السجل من مسودة الخطة.";
  });
 }
 async function importApprovedGoals(){
  await action(async()=>{
   if(!plan?.source_workshop_id)throw new Error("لم تُربط الخطة بورشة مصدر.");
   const x=await supabase.from("planning_form_reviews").select("stage,fields,finalized_at")
    .eq("workshop_id",plan.source_workshop_id).eq("stage",3).maybeSingle();
   if(x.error)throw x.error;
   if(!x.data?.finalized_at)throw new Error("لم تُعتمد ورقة الأهداف (3) نهائيًا في ورشة المصدر.");
   const fields=x.data.fields as Record<string,{content?:string;status?:string}>;
   if(fields?.goals?.status!=="approved")throw new Error("لم تُعتمد خانة الأهداف في ورشة المصدر.");
   const entries=splitApprovedGoals(fields.goals.content??"");
   if(!entries.length)throw new Error("ورقة الأهداف المعتمدة لا تحتوي على أهداف.");
   const newGoals=entries.filter(t=>!goals.some(g=>g.title===t));
   if(!newGoals.length)return "جميع أهداف الورشة المعتمدة موجودة بالفعل في مسودة الخطة.";
   const result=await supabase.from("planning_strategic_goals").upsert(
    newGoals.map((title,i)=>({organization_id:plan.organization_id,plan_id:id,title,
     sort_order:goals.length+i})),
    {onConflict:"plan_id,title",ignoreDuplicates:true}
   );
   if(result.error)throw result.error;
   return "أُضيفت الأهداف المعتمدة من الورشة إلى المسودة، ويمكن الآن ربطها بالأنشطة والمؤشرات.";
  });
 }
 if(loading)return <main className="wrap"><p className="card">جارٍ تحميل الخطة الاستراتيجية…</p></main>;
 if(!plan)return <main className="wrap"><Link href="/plans">← الخطط المؤسسية</Link>
  <p role="alert" className="card error">{error||"الخطة غير موجودة أو لا تملك صلاحية عرضها."}</p></main>;
 const goalName=(goalId:string)=>goals.find(g=>g.id===goalId)?.title??"هدف غير متاح";
 const budgets=activities.reduce<Record<string,number>>((acc,a)=>{
  if(a.estimated_budget!=null)acc[a.currency_code]=(acc[a.currency_code]??0)+a.estimated_budget;
  return acc;
 },{});
 return <main className="wrap institutional-app" dir="rtl">
  <header className="institutional-hero">
   <div><Link href="/plans" className="institutional-back">← جميع الخطط</Link>
    <p className="institutional-kicker">مسودة الخطة • الإصدار {plan.revision}</p>
    <h1>{plan.title}</h1>
    <p>الفترة: {plan.period_start} — {plan.period_end}</p></div>
   <span className="institutional-pill">مسودة غير معتمدة</span>
  </header>
  <div className="institutional-metrics">
   <div><strong>{goals.length}</strong><small>أهداف استراتيجية</small></div>
   <div><strong>{activities.length}</strong><small>أنشطة تشغيلية</small></div>
   <div><strong>{indicators.length}</strong><small>مؤشرات أداء</small></div>
   <div><strong>{Object.keys(budgets).length}</strong><small>عملات موازنة مسجلة</small></div>
  </div>
  <p className="muted">ملخص الموازنات حسب العملة: {Object.entries(budgets).map(([currency,amount])=>`${n(amount)} ${currency}`).join(" • ")||"لا توجد موازنات بعد"}. لا تجمع بوصلة عملات مختلفة في إجمالي واحد.</p>
  {error&&<p role="alert" className="card error">{error}</p>}
  {notice&&<p role="status" className="card good">{notice}</p>}
  <nav className="institutional-tabs" aria-label="أقسام الخطة">
   {([["vision","التوجه الاستراتيجي"],["goals","الأهداف"],["activities","الخطة التشغيلية"],["indicators","مؤشرات الأداء"]] as const)
    .map(([key,label])=><button key={key} className={active===key?"primary":"secondary"} onClick={()=>setActive(key)}>{label}</button>)}
  </nav>
  {active==="vision"&&<section className="card institutional-card">
   <h2>الهوية والتوجه الاستراتيجي</h2>
   <p className="muted">اكتب الصياغة المؤسسية المعتمدة للنقاش. هذه مسودة قابلة للتعديل وليست اعتمادًا رسميًا.</p>
   <form className="stack" onSubmit={saveDirection}>
    <label>الرؤية<textarea rows={3} maxLength={6000} className="field" value={draft.vision} onChange={e=>setDraft(p=>({...p,vision:e.target.value}))}/></label>
    <label>الرسالة<textarea rows={3} maxLength={6000} className="field" value={draft.mission} onChange={e=>setDraft(p=>({...p,mission:e.target.value}))}/></label>
    <label>القيم المؤسسية<textarea rows={3} maxLength={6000} className="field" value={draft.institutional_values} onChange={e=>setDraft(p=>({...p,institutional_values:e.target.value}))}/></label>
    <label>تحليل الواقع والبيئة / القضايا الاستراتيجية<textarea rows={5} maxLength={30000} className="field" value={draft.environmental_analysis} onChange={e=>setDraft(p=>({...p,environmental_analysis:e.target.value}))}/></label>
    <button className="primary" disabled={busy}>{busy?"جارٍ الحفظ…":"حفظ التوجه الاستراتيجي"}</button>
   </form>
  </section>}
  {active==="goals"&&<section className="card institutional-card">
   <h2>الأهداف الاستراتيجية</h2>
   {plan.source_workshop_id&&<div className="institutional-actions">
    <button className="secondary" type="button" disabled={busy} onClick={()=>void importApprovedGoals()}>استيراد الأهداف المعتمدة من ورشة المصدر</button>
    <Link className="chip" href={"/workshops/"+plan.source_workshop_id}>فتح ورشة المصدر</Link>
   </div>}
   <form className="institutional-form" onSubmit={createGoal}>
    <label>عنوان الهدف<input className="field" required minLength={3} maxLength={300} value={goal.title} onChange={e=>setGoal(p=>({...p,title:e.target.value}))}/></label>
    <label>المحور الاستراتيجي<input className="field" maxLength={300} value={goal.strategic_axis} onChange={e=>setGoal(p=>({...p,strategic_axis:e.target.value}))}/></label>
    <label>رمز الهدف<input className="field" maxLength={30} placeholder="G-01" value={goal.code} onChange={e=>setGoal(p=>({...p,code:e.target.value}))}/></label>
    <label>الأولوية (1 الأعلى)<select className="field" value={goal.priority} onChange={e=>setGoal(p=>({...p,priority:Number(e.target.value)}))}>
     {[1,2,3,4,5].map(v=><option key={v} value={v}>{v}</option>)}
    </select></label>
    <label className="institutional-span">وصف الهدف / النتائج المتوقعة<textarea rows={2} className="field" maxLength={5000} value={goal.description} onChange={e=>setGoal(p=>({...p,description:e.target.value}))}/></label>
    <div className="institutional-span institutional-actions">
     <button className="primary" disabled={busy}>{editingGoalId?"حفظ تعديل الهدف":"إضافة هدف استراتيجي"}</button>
     {editingGoalId&&<button type="button" className="secondary" disabled={busy} onClick={()=>{setEditingGoalId("");setGoal({title:"",description:"",strategic_axis:"",code:"",priority:3});}}>إلغاء التعديل</button>}
    </div>
   </form>
   <div className="institutional-records">{goals.map(g=><article key={g.id} className="institutional-record">
    <div><span className="institutional-pill">{g.code||"هدف"} • أولوية {g.priority}</span><h3>{g.title}</h3>
     <small>{g.strategic_axis}</small><p>{g.description}</p></div>
    <div className="institutional-actions">
      <button className="secondary" disabled={busy} onClick={()=>beginGoalEdit(g)}>تعديل</button>
      <button className="secondary" disabled={busy} onClick={()=>void remove("goal",g.id)}>حذف</button>
    </div>
   </article>)}</div>
  </section>}
  {active==="activities"&&<section className="card institutional-card">
   <h2>الخطة التشغيلية وربط الأنشطة بالأهداف</h2>
   {!goals.length?<p className="error">أضف هدفًا استراتيجيًا أولًا قبل إدراج الأنشطة.</p>:<form className="institutional-form" onSubmit={createActivity}>
    <label className="institutional-span">الهدف المرتبط<select className="field" required value={activity.goal_id} onChange={e=>setActivity(p=>({...p,goal_id:e.target.value}))}>
     {goals.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
    <label>اسم النشاط<input className="field" required minLength={3} maxLength={300} value={activity.title} onChange={e=>setActivity(p=>({...p,title:e.target.value}))}/></label>
    <label>البرنامج / المبادرة<input className="field" value={activity.program_name} onChange={e=>setActivity(p=>({...p,program_name:e.target.value}))}/></label>
    <label>المشروع<input className="field" value={activity.project_name} onChange={e=>setActivity(p=>({...p,project_name:e.target.value}))}/></label>
    <label>المسؤول<input className="field" value={activity.owner_name} onChange={e=>setActivity(p=>({...p,owner_name:e.target.value}))}/></label>
    <label>الفئة المستهدفة<input className="field" value={activity.target_group} onChange={e=>setActivity(p=>({...p,target_group:e.target.value}))}/></label>
    <label>العدد المستهدف<input type="number" min={0} step="any" className="field" value={activity.target_quantity} onChange={e=>setActivity(p=>({...p,target_quantity:e.target.value}))}/></label>
    <label>وحدة القياس<input className="field" placeholder="طفل / أسرة / جلسة" value={activity.target_unit} onChange={e=>setActivity(p=>({...p,target_unit:e.target.value}))}/></label>
    <label>بداية التنفيذ<input className="field" type="date" value={activity.planned_start} onChange={e=>setActivity(p=>({...p,planned_start:e.target.value}))}/></label>
    <label>نهاية التنفيذ<input className="field" type="date" min={activity.planned_start||undefined} value={activity.planned_end} onChange={e=>setActivity(p=>({...p,planned_end:e.target.value}))}/></label>
    <label>التكلفة التقديرية<input className="field" type="number" min={0} step="any" value={activity.estimated_budget} onChange={e=>setActivity(p=>({...p,estimated_budget:e.target.value}))}/></label>
    <label>العملة<select className="field" value={activity.currency_code} onChange={e=>setActivity(p=>({...p,currency_code:e.target.value as typeof activity.currency_code}))}>
     {["ILS","USD","EUR","JOD","EGP"].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
    <label className="institutional-span">المخاطر أو الاحتياجات<textarea className="field" rows={2} value={activity.risk_notes} onChange={e=>setActivity(p=>({...p,risk_notes:e.target.value}))}/></label>
    <div className="institutional-span institutional-actions">
     <button className="primary" disabled={busy||!activity.goal_id}>{editingActivityId?"حفظ تعديل النشاط":"إضافة النشاط إلى الخطة التشغيلية"}</button>
     {editingActivityId&&<button className="secondary" type="button" disabled={busy} onClick={()=>{setEditingActivityId("");setActivity({...emptyActivity,goal_id:goals[0]?.id??""});}}>إلغاء التعديل</button>}
    </div>
   </form>}
   <div className="institutional-records">{activities.map(a=><article key={a.id} className="institutional-record">
    <div><span className="institutional-pill">{a.program_name||"برنامج غير محدد"}</span><h3>{a.title}</h3>
     <p><strong>الهدف:</strong> {goalName(a.goal_id)}</p>
     <small>{a.owner_name||"مسؤول غير محدد"} • {a.planned_start||"—"} إلى {a.planned_end||"—"}</small>
     <p>المستهدف: {n(a.target_quantity)} {a.target_unit} • التكلفة: {n(a.estimated_budget)} {a.currency_code}</p></div>
    <div className="institutional-actions">
     <button className="secondary" disabled={busy} onClick={()=>beginActivityEdit(a)}>تعديل</button>
     <button className="secondary" disabled={busy} onClick={()=>void remove("activity",a.id)}>حذف</button>
    </div>
   </article>)}</div>
  </section>}
  {active==="indicators"&&<section className="card institutional-card">
   <h2>مؤشرات قياس النجاح KPI</h2>
   {!goals.length?<p className="error">أضف هدفًا استراتيجيًا أولًا قبل إنشاء مؤشرات الأداء.</p>:<form className="institutional-form" onSubmit={createKpi}>
    <label className="institutional-span">الهدف الاستراتيجي<select required className="field" value={kpi.goal_id} onChange={e=>setKpi(p=>({...p,goal_id:e.target.value}))}>
     {goals.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
    <label>اسم المؤشر<input required minLength={3} maxLength={300} className="field" value={kpi.title} onChange={e=>setKpi(p=>({...p,title:e.target.value}))}/></label>
    <label>وحدة المؤشر<input className="field" value={kpi.unit} onChange={e=>setKpi(p=>({...p,unit:e.target.value}))} placeholder="% / شخص / عدد"/></label>
    <label>خط الأساس<input type="number" step="any" className="field" value={kpi.baseline} onChange={e=>setKpi(p=>({...p,baseline:e.target.value}))}/></label>
    <label>المستهدف<input type="number" step="any" className="field" value={kpi.target} onChange={e=>setKpi(p=>({...p,target:e.target.value}))}/></label>
    <label>دورية القياس<select className="field" value={kpi.frequency} onChange={e=>setKpi(p=>({...p,frequency:e.target.value as typeof kpi.frequency}))}>
     {Object.entries(frequencyLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>مصدر التحقق<input className="field" value={kpi.verification_source} onChange={e=>setKpi(p=>({...p,verification_source:e.target.value}))}/></label>
    <label className="institutional-span">طريقة احتساب المؤشر<textarea className="field" rows={2} value={kpi.methodology} onChange={e=>setKpi(p=>({...p,methodology:e.target.value}))}/></label>
    <div className="institutional-span institutional-actions">
     <button className="primary" disabled={busy||!kpi.goal_id}>{editingKpiId?"حفظ تعديل المؤشر":"إضافة المؤشر"}</button>
     {editingKpiId&&<button className="secondary" type="button" disabled={busy} onClick={()=>{setEditingKpiId("");setKpi({...emptyKpi,goal_id:goals[0]?.id??""});}}>إلغاء التعديل</button>}
    </div>
   </form>}
   <div className="institutional-records">{indicators.map(k=><article key={k.id} className="institutional-record">
    <div><span className="institutional-pill">{frequencyLabels[k.frequency]}</span><h3>{k.title}</h3>
     <p><strong>الهدف:</strong> {goalName(k.goal_id)}</p>
     <small>خط الأساس: {n(k.baseline)} • المستهدف: {n(k.target)} {k.unit} • المصدر: {k.verification_source||"غير محدد"}</small></div>
    <div className="institutional-actions">
     <button className="secondary" disabled={busy} onClick={()=>beginKpiEdit(k)}>تعديل</button>
     <button className="secondary" disabled={busy} onClick={()=>void remove("indicator",k.id)}>حذف</button>
    </div>
   </article>)}</div>
  </section>}
  <footer className="card">
   <strong>ضوابط اعتماد الخطة</strong>
   <p className="muted">هذه نسخة إعداد أولية. تسجيل الإنجازات وإقرار الخطة ونشر الإصدارات النهائية غير مفعّل بعد، ولن تُحتسب نسب الإنجاز تلقائيًا من عدد الأنشطة.</p>
  </footer>
 </main>;
}
