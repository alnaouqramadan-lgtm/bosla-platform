"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabase";
import {validatePlanPeriod,type StrategicPlan} from "@/lib/institutional-planning";
import type {Organization,Workshop} from "@/lib/types";

function message(e:unknown){return e instanceof Error?e.message:String(e);}
export default function PlansHome(){
 const router=useRouter();
 const [orgs,setOrgs]=useState<Organization[]>([]);
 const [visibleOrgs,setVisibleOrgs]=useState<Organization[]>([]);
 const [currentUserId,setCurrentUserId]=useState("");
 const [workshops,setWorkshops]=useState<Workshop[]>([]);
 const [plans,setPlans]=useState<StrategicPlan[]>([]);
 const [selectedOrg,setSelectedOrg]=useState("");
 const [sourceWorkshop,setSourceWorkshop]=useState("");
 const [title,setTitle]=useState("");
 const [start,setStart]=useState("2027-01-01");
 const [end,setEnd]=useState("2029-12-31");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  const auth=await supabase.auth.getUser();
  if(auth.error)throw auth.error;
  if(!auth.data.user){router.replace("/login");return;}
  const [orgRes,planRes,workshopRes]=await Promise.all([
   supabase.from("planning_organizations").select("id,name,owner_id").order("name"),
   supabase.from("planning_strategic_plans")
    .select("id,organization_id,source_workshop_id,created_by,title,period_start,period_end,vision,mission,institutional_values,environmental_analysis,status,revision,created_at,updated_at")
    .order("created_at",{ascending:false}),
   supabase.from("planning_workshops")
    .select("id,organization_id,title,planning_year,workshop_date,created_by,open_stages,allow_individual,vote_open,status")
    .order("created_at",{ascending:false})
  ]);
  for(const r of [orgRes,planRes,workshopRes])if(r.error)throw r.error;
  const owned=(orgRes.data??[]).filter(o=>o.owner_id===auth.data.user!.id) as Organization[];
  setOrgs(owned);
  setVisibleOrgs((orgRes.data??[]) as Organization[]);
  setCurrentUserId(auth.data.user!.id);
  setSelectedOrg(current=>owned.some(o=>o.id===current)?current:owned[0]?.id??"");
  setPlans((planRes.data??[]) as StrategicPlan[]);
  setWorkshops((workshopRes.data??[]) as Workshop[]);
 },[router]);
 useEffect(()=>{let mounted=true;
  load().catch(e=>{if(mounted)setError(message(e));})
   .finally(()=>{if(mounted)setLoading(false);});
  return()=>{mounted=false;};
 },[load]);
 async function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  setBusy(true);setError("");
  try{
   if(!orgs.some(o=>o.id===selectedOrg))throw new Error("اختر مؤسسة تملك صلاحية إدارتها.");
   validatePlanPeriod(start,end);
   const result=await supabase.from("planning_strategic_plans").insert({
    organization_id:selectedOrg,title:title.trim(),period_start:start,period_end:end,
    source_workshop_id:sourceWorkshop||null
   }).select("id").single();
   if(result.error)throw result.error;
   router.push("/plans/"+result.data.id);
  }catch(e){setError(message(e));}finally{setBusy(false);}
 }
 return <main className="wrap institutional-app" dir="rtl">
  <header className="institutional-hero">
   <div><p className="institutional-kicker">BOSLA AI • التخطيط المؤسسي</p>
    <h1>الخطط الاستراتيجية والتشغيلية</h1>
    <p>من الرؤية والأهداف إلى الأنشطة والمؤشرات، في خطة واحدة مترابطة قابلة للتطوير والمتابعة.</p></div>
   <Link href="/dashboard" className="chip">العودة للورش</Link>
  </header>
  {error&&<p role="alert" className="error card">{error}</p>}
  {loading&&<p className="card">جارٍ تحميل الخطط المؤسسية…</p>}
  <section className="card institutional-card">
   <h2>إنشاء خطة مؤسسية</h2>
   <p className="muted">يمكن بناء الخطة مباشرة، أو ربطها بورشة لاقتراح الأهداف المعتمدة لاحقًا. إنشاء الخطة لا يغيّر مخرجات الورشة.</p>
   {!loading&&!orgs.length?<p className="muted">يتاح إنشاء الخطط حاليًا لمالك المؤسسة. اطلب من مدير بوصلة إنشاء مؤسسة مخصصة لك أو منحك صلاحية إدارة مناسبة عند تفعيل الأدوار المؤسسية.</p>:
   <form className="institutional-form" onSubmit={create}>
    <label>المؤسسة<select className="field" required value={selectedOrg} onChange={e=>{setSelectedOrg(e.target.value);setSourceWorkshop("");}}>
     {orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
    </select></label>
    <label>اسم الخطة<input className="field" required minLength={3} maxLength={200}
      value={title} onChange={e=>setTitle(e.target.value)} placeholder="الخطة الاستراتيجية للمؤسسة 2027–2029"/></label>
    <label>بداية الخطة<input type="date" className="field" required value={start} onChange={e=>setStart(e.target.value)}/></label>
    <label>نهاية الخطة<input type="date" className="field" required min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label>
    <label className="institutional-span">ورشة المصدر (اختيارية)
     <select className="field" value={sourceWorkshop} onChange={e=>setSourceWorkshop(e.target.value)}>
      <option value="">إنشاء خطة مباشرة دون ورشة</option>
      {workshops.filter(w=>w.organization_id===selectedOrg).map(w=><option key={w.id} value={w.id}>{w.title} — {w.planning_year}</option>)}
     </select>
    </label>
    <button className="primary institutional-span" disabled={busy||!orgs.length}>{busy?"جارٍ إنشاء الخطة…":"إنشاء مسودة الخطة"}</button>
   </form>}
  </section>
  <section className="card institutional-card">
   <h2>الصلاحيات والعضوية</h2>
   <p className="muted">لإضافة مستخدم مسجّل إلى مؤسسة، اطلب منه مشاركة معرف حسابه مع مالك المؤسسة. عضو المؤسسة يستطيع قراءة الخطط المعتمدة فقط؛ وقد يعيّنه المالك بصورة مستقلة محررًا أو مراجعًا لخطة محددة.</p>
   <details><summary>معرف حسابي — للمشاركة مع مالك المؤسسة</summary>
    <input className="field" aria-label="معرف حسابي" readOnly dir="ltr" value={currentUserId}/>
   </details>
   {orgs.length>0&&<div className="institutional-actions">{orgs.map(o=>
    <Link key={o.id} className="chip" href={"/organizations/"+o.id+"/members"}>إدارة أعضاء {o.name}</Link>)}
   </div>}
  </section>
  <section className="card institutional-card">
   <h2>خطط المؤسسة</h2>
   {!loading&&!plans.length&&<p className="muted">لا توجد خطط متاحة لحسابك حاليًا. يعرض بوصلة للأعضاء الخطط المعتمدة فقط.</p>}
   <div className="institutional-plan-list">{plans.map(p=><Link className="institutional-plan-card" key={p.id} href={"/plans/"+p.id}>
    <span className="institutional-pill">{p.status==="approved"?"خطة معتمدة":p.status==="in_review"?"بانتظار المراجع":p.status==="reviewed"?"بانتظار اعتماد المالك":"مسودة قيد الإعداد"}</span>
    <strong>{p.title}</strong>
    <small>{visibleOrgs.find(o=>o.id===p.organization_id)?.name??"المؤسسة"} • {p.period_start} — {p.period_end}</small>
    <span>{p.status==="approved"?"فتح الخطة والتقارير الدورية":p.status==="draft"?"فتح المسودة":"عرض مسار الاعتماد"} ←</span>
   </Link>)}</div>
  </section>
  <p className="muted">يستطيع مالك المؤسسة تعيين محرر ومراجع مستقل ومشاهد لكل خطة. يتطلب الاعتماد النهائي موافقة المراجع إذا تم تكليفه، بينما تبقى الخطط المعتمدة ثابتة وتُسجّل نتائجها الفعلية بأدلتها.</p>
 </main>;
}
