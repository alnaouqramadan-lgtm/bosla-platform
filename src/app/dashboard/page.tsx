"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabase";
import type {Organization,Workshop} from "@/lib/types";

export default function Dashboard(){
 const router=useRouter();
 const[userId,setUserId]=useState(""); const[myName,setMyName]=useState("");
 const[orgs,setOrgs]=useState<Organization[]>([]); const[workshops,setWorkshops]=useState<Workshop[]>([]);
 const[selectedOrg,setSelectedOrg]=useState("");
 const[orgName,setOrgName]=useState(""); const[title,setTitle]=useState("");
 const[year,setYear]=useState(new Date().getFullYear());
 const[date,setDate]=useState(new Date().toLocaleDateString("en-CA"));
 const[joinCode,setJoinCode]=useState(""); const[recentCode,setRecentCode]=useState(""); const[recentWorkshop,setRecentWorkshop]=useState("");
 const[busy,setBusy]=useState(false);const[loading,setLoading]=useState(true);const[error,setError]=useState("");const[notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  const a=await supabase.auth.getUser();if(!a.data.user){router.replace("/login");return;}
  const uid=a.data.user.id;setUserId(uid);
  const preferredName=String(a.data.user.user_metadata?.full_name || a.data.user.email?.split("@")[0] || "مشارك");
  const safeName=preferredName.trim().length>=2?preferredName.trim().slice(0,120):"مشارك";
  const profile=await supabase.from("planning_profiles").upsert({id:uid,full_name:safeName}, {onConflict:"id"})
   .select("full_name").single();
  if(profile.error)throw profile.error;
  setMyName(profile.data?.full_name??safeName);
  const [o,w]=await Promise.all([
   supabase.from("planning_organizations").select("id,name,owner_id").order("created_at",{ascending:false}),
   supabase.from("planning_workshops").select("id,organization_id,title,planning_year,workshop_date,created_by,open_stages,allow_individual,vote_open,status")
    .order("created_at",{ascending:false}),
  ]);
  if(o.error)throw o.error;if(w.error)throw w.error;
  const organizations=(o.data??[]) as Organization[];
  setOrgs(organizations);setWorkshops((w.data??[]) as Workshop[]);
  setSelectedOrg(prev=>prev || organizations[0]?.id || "");
 },[router]);
 useEffect(()=>{let mounted=true;load().catch(e=>{if(mounted)setError(String(e.message||e));})
 .finally(()=>{if(mounted)setLoading(false);});return()=>{mounted=false};},[load]);
 async function createOrg(e:FormEvent){e.preventDefault();if(busy||!userId)return;setBusy(true);setError("");
  try{const result=await supabase.from("planning_organizations").insert({name:orgName.trim(),owner_id:userId}).select("id").single();
   if(result.error)throw result.error;setSelectedOrg(result.data.id);setOrgName("");setNotice("تم إنشاء المؤسسة الجديدة.");await load();
  }catch(e){setError(String((e as Error).message||e));}finally{setBusy(false);}
 }
 async function createWorkshop(e:FormEvent){e.preventDefault();if(busy||!userId||!selectedOrg)return;
  setBusy(true);setError("");setRecentCode("");
  try{const code=crypto.randomUUID()+"-"+crypto.randomUUID();
   const binary=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code));
   const hash=Array.from(new Uint8Array(binary),n=>n.toString(16).padStart(2,"0")).join("");
   const result=await supabase.from("planning_workshops").insert({
    organization_id:selectedOrg,title:title.trim(),planning_year:year,workshop_date:date,created_by:userId,invite_hash:hash
   }).select("id").single();
   if(result.error)throw result.error;
   setRecentCode(code);setRecentWorkshop(result.data.id);setTitle("");setNotice("تم إنشاء الورشة. احتفظ برمز الدعوة في مكان آمن.");await load();
  }catch(e){setError(String((e as Error).message||e));}finally{setBusy(false);}
 }
 async function join(e:FormEvent){e.preventDefault();if(busy||!joinCode.trim())return;setBusy(true);setError("");
  try{const r=await supabase.rpc("planning_join_by_code",{p_code:joinCode.trim()});if(r.error)throw r.error;
   if(typeof r.data!=="string")throw Error("لم يتم العثور على الورشة");
   router.push("/workshops/"+r.data);
  }catch(e){setError(String((e as Error).message||e));}finally{setBusy(false);}
 }
 async function logout(){await supabase.auth.signOut();router.replace("/login");}
 const inviteUrl=recentWorkshop&&recentCode&&typeof window!=="undefined"
  ? window.location.origin+"/workshops/"+recentWorkshop+"?code="+encodeURIComponent(recentCode):"";
 return <main className="wrap">
 <header className="toolbar" style={{justifyContent:"space-between",marginBottom:16}}>
 <div><h1 className="title">🧭 بوصلة | BOSLA AI</h1><p>مرحبًا، {myName}</p></div>
 <button className="secondary no-print" onClick={()=>void logout()}>خروج</button>
 </header>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="good" role="status">{notice}</p>}
 {loading&&<p>جارٍ التحميل...</p>}
 <div className="two-cols">
 <section className="card"><h2>مؤسسة جديدة</h2>
 <form className="stack" onSubmit={createOrg}>
 <label>اسم المؤسسة<input required minLength={2} maxLength={200} className="field" value={orgName} onChange={e=>setOrgName(e.target.value)}/></label>
 <button className="primary" disabled={busy}>إضافة المؤسسة</button></form>
 </section>
 <section className="card"><h2>الانضمام إلى ورشة</h2>
 <p className="muted">يمكنك الانضمام إلى أي ورشة دُعيت إليها، عبر رمز آمن، دون الحاجة إلى حساب في إنجاز.</p>
 <form className="stack" onSubmit={join}>
 <input className="field" aria-label="رمز الدعوة" value={joinCode} onChange={e=>setJoinCode(e.target.value)} required placeholder="الصق رمز الدعوة"/>
 <button className="primary" disabled={busy}>دخول الورشة</button>
 </form></section>
 </div>
 <section className="card"><h2>إنشاء ورشة تخطيط</h2>
 <p className="muted">صاحب المؤسسة يستطيع إنشاء الورش وإدارة أدوار الميسر والمشاركين.</p>
 <form className="two-cols" onSubmit={createWorkshop}>
 <label>المؤسسة<select className="field" value={selectedOrg} required onChange={e=>setSelectedOrg(e.target.value)}><option value="">اختر المؤسسة</option>
 {orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
 <label>عنوان الورشة<input className="field" required minLength={2} maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label>السنة<input className="field" type="number" min={2020} max={2200} required value={year} onChange={e=>setYear(Number(e.target.value))}/></label>
 <label>تاريخ الورشة<input className="field" type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
 <button className="primary" disabled={!selectedOrg||busy}>{busy?"جارٍ التنفيذ...":"إنشاء الورشة"}</button>
 </form>
 </section>
 {recentCode&&<section className="card" style={{borderColor:"#16a34a"}}>
 <h2>رمز دعوة الورشة الجديدة</h2><p>انسخه الآن؛ المنصة تخزّن بصمته فقط ولا تستطيع استعادته كما هو.</p>
 <code dir="ltr" style={{display:"block",overflowWrap:"anywhere",marginBottom:12}}>{recentCode}</code>
 <div className="toolbar"><button className="primary" onClick={()=>void navigator.clipboard.writeText(inviteUrl)}>نسخ رابط الدعوة</button>
 <Link href={"/workshops/"+recentWorkshop}>إدارة الورشة</Link></div>
 </section>}
 <section className="card"><h2>ورشك المتاحة</h2>
 {!loading&&workshops.length===0&&<p>لم يتم إنشاء ورش أو الانضمام إليها بعد.</p>}
 <div className="two-cols">{workshops.map(w=><Link key={w.id} href={"/workshops/"+w.id} className="chip" style={{display:"block",textDecoration:"none",minHeight:95}}>
 <strong>{w.title}</strong><p className="muted">{w.planning_year} | {w.workshop_date} | {w.status==="active"?"نشطة":"مؤرشفة"}</p>
 </Link>)}</div></section>
 </main>;
}
