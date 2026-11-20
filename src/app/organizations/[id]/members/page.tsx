"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import {supabase} from "@/lib/supabase";

type Role="planner"|"executive_reviewer"|"board_viewer";
type Member={organization_id:string;user_id:string;display_name:string;role:Role;status:"active"|"suspended";created_at:string};
type Organization={id:string;name:string;owner_id:string};
const labels:Record<Role,string>={
 planner:"مُعدّ الخطة — اطلاع في هذه المرحلة",
 executive_reviewer:"الإدارة التنفيذية — اطلاع في هذه المرحلة",
 board_viewer:"مجلس الإدارة — مشاهدة فقط"
};
const message=(error:unknown)=>error instanceof Error?error.message:String(error);
const isUUID=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export default function OrganizationMembers(){
 const {id}=useParams<{id:string}>();const router=useRouter();
 const [organization,setOrganization]=useState<Organization|null>(null);
 const [members,setMembers]=useState<Member[]>([]);
 const [fullName,setFullName]=useState("");
 const [userId,setUserId]=useState("");
 const [role,setRole]=useState<Role>("board_viewer");
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  const auth=await supabase.auth.getUser();
  if(auth.error)throw auth.error;
  if(!auth.data.user){router.replace("/login");return;}
  const org=await supabase.from("planning_organizations").select("id,name,owner_id").eq("id",id).maybeSingle();
  if(org.error)throw org.error;
  if(!org.data||org.data.owner_id!==auth.data.user.id){
   setOrganization(null);throw new Error("إدارة أعضاء هذه المؤسسة متاحة لمالك المؤسسة فقط.");
  }
  setOrganization(org.data as Organization);
  const result=await supabase.from("planning_organization_members")
   .select("organization_id,user_id,display_name,role,status,created_at")
   .eq("organization_id",id).order("created_at",{ascending:false});
  if(result.error)throw result.error;
  setMembers((result.data??[]) as Member[]);
 },[id,router]);
 useEffect(()=>{let mounted=true;load().catch(e=>{if(mounted)setError(message(e));})
  .finally(()=>{if(mounted)setLoading(false);});return()=>{mounted=false;};},[load]);

 async function add(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setError("");setNotice("");
  if(!isUUID(userId.trim())){setError("أدخل معرف حساب صحيحًا من المستخدم المسجل.");return;}
  if(fullName.trim().length<2){setError("اكتب اسم العضو لتمييزه داخل المؤسسة.");return;}
  setBusy(true);
  try{
   const result=await supabase.from("planning_organization_members").insert({
    organization_id:id,user_id:userId.trim(),display_name:fullName.trim(),role,status:"active"
   }).select("user_id").single();
   if(result.error)throw result.error;
   setFullName("");setUserId("");setRole("board_viewer");
   await load();setNotice("تمت إضافة العضو. يمكنه الآن مشاهدة الخطط المعتمدة فقط.");
  }catch(e){setError(message(e));}finally{setBusy(false);}
 }
 async function change(member:Member,patch:Partial<Pick<Member,"role"|"status">>){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await supabase.from("planning_organization_members").update(patch)
    .eq("organization_id",id).eq("user_id",member.user_id).select("user_id").single();
   if(result.error)throw result.error;
   await load();setNotice("حُدثت صلاحية العضو بنجاح.");
  }catch(e){setError(message(e));}finally{setBusy(false);}
 }
 async function remove(member:Member){
  if(busy||!window.confirm("حذف عضوية "+member.display_name+" نهائيًا من هذه المؤسسة؟"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await supabase.from("planning_organization_members").delete()
    .eq("organization_id",id).eq("user_id",member.user_id).select("user_id").single();
   if(result.error)throw result.error;
   await load();setNotice("حُذفت العضوية؛ لم تُحذف بيانات الحساب.");
  }catch(e){setError(message(e));}finally{setBusy(false);}
 }
 return <main className="wrap institutional-app" dir="rtl">
  <header className="institutional-hero">
   <div><Link className="institutional-back" href="/plans">← الخطط المؤسسية</Link>
    <h1>أعضاء المؤسسة والصلاحيات</h1>
    <p>{organization?.name??"إدارة الصلاحيات"} — المرحلة الأولى من الحوكمة المؤسسية</p></div>
  </header>
  {error&&<p className="card error" role="alert">{error}</p>}
  {notice&&<p className="card good" role="status">{notice}</p>}
  {loading&&<p className="card">جارٍ تحميل الأعضاء…</p>}
  {organization&&<section className="card institutional-card">
   <h2>إضافة مستخدم مسجّل</h2>
   <p className="muted">اطلب من المستخدم فتح صفحة الخطط ونسخ «معرف حسابي» وإرساله إليك. الإضافة هنا لا ترسل بريدًا أو واتساب تلقائيًا.</p>
   <p className="muted">جميع الأدوار في هذه المرحلة يمكنها الاطلاع على الخطط المعتمدة وبيانات تنفيذها فقط. يظل تعديل المسودات والاعتماد وتسجيل الإنجاز من صلاحيات المالك؛ سيُفعّل سير الاعتماد متعدد المستويات في مرحلة مستقلة.</p>
   <form className="institutional-form" onSubmit={add}>
    <label>اسم العضو<input className="field" required minLength={2} maxLength={200}
     value={fullName} onChange={e=>setFullName(e.target.value)}/></label>
    <label>معرف حساب المستخدم المسجل<input className="field" required autoComplete="off" placeholder="UUID"
     value={userId} onChange={e=>setUserId(e.target.value)}/></label>
    <label className="institutional-span">الدور<select className="field" value={role}
     onChange={e=>setRole(e.target.value as Role)}>
     {(Object.keys(labels) as Role[]).map(r=><option key={r} value={r}>{labels[r]}</option>)}
    </select></label>
    <button className="primary institutional-span" disabled={busy}>{busy?"جارٍ الإضافة…":"إضافة العضو"}</button>
   </form>
  </section>}
  {organization&&<section className="card institutional-card">
   <h2>الأعضاء ({members.length})</h2>
   {!members.length&&<p className="muted">لم تُضف أي عضوية إلى هذه المؤسسة بعد.</p>}
   <div className="institutional-records">{members.map(m=><article key={m.user_id} className="institutional-record">
    <div><strong>{m.display_name}</strong>
     <p className="muted">المعرف: <code dir="ltr">{m.user_id}</code></p>
     <p className="muted">الحالة: {m.status==="active"?"نشط":"موقوف"} • أضيف في {m.created_at.slice(0,10)}</p>
    </div>
    <div className="institutional-actions">
     <label>الدور
      <select className="field" value={m.role} disabled={busy} onChange={e=>void change(m,{role:e.target.value as Role})}>
       {(Object.keys(labels) as Role[]).map(r=><option key={r} value={r}>{labels[r]}</option>)}
      </select>
     </label>
     <button type="button" className="secondary" disabled={busy}
      onClick={()=>void change(m,{status:m.status==="active"?"suspended":"active"})}>
      {m.status==="active"?"إيقاف الوصول":"إعادة التفعيل"}
     </button>
     <button type="button" className="secondary" disabled={busy} onClick={()=>void remove(m)}>حذف العضوية</button>
    </div>
   </article>)}</div>
  </section>}
 </main>;
}
