"use client";
import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabase";
export default function Login(){
 const router=useRouter();
 const redirect=()=>{
  const next=new URLSearchParams(window.location.search).get("next");
  const allowed=next && /^\/workshops\/[0-9a-f-]{36}(?:\?code=[0-9a-f-]{36,140})?$/i.test(next);
  router.replace(allowed && next ? next : "/dashboard");
 };const[email,setEmail]=useState("");const[password,setPassword]=useState("");
 const[name,setName]=useState("");const[register,setRegister]=useState(false);
 const[busy,setBusy]=useState(false);const[error,setError]=useState("");const[notice,setNotice]=useState("");
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");
 try {
  if(register){
   const result=await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:name.trim()}}});
   if(result.error)throw result.error;
   if(result.data.user && result.data.session){
    const saved=await supabase.from("planning_profiles").upsert({id:result.data.user.id,full_name:name.trim()});
    if(saved.error) throw saved.error;
    redirect();
   } else setNotice("تم إرسال رسالة التحقق إلى بريدك الإلكتروني. فعّل الحساب ثم سجّل الدخول.");
  }else{
   const result=await supabase.auth.signInWithPassword({email:email.trim(),password});
   if(result.error)throw result.error;
   redirect();
  }
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 return <main className="wrap" style={{maxWidth:550}}>
 <h1 className="title">🧭 بوصلة | BOSLA AI</h1><section className="card">
 <h2>{register?"إنشاء حساب جديد":"تسجيل الدخول"}</h2>
 <form className="stack" onSubmit={submit}>
 {register&&<label>الاسم الكامل<input className="field" required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>}
 <label>البريد الإلكتروني<input type="email" className="field" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>كلمة المرور<input type="password" className="field" minLength={8} autoComplete={register?"new-password":"current-password"} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <button type="submit" className="primary" disabled={busy}>{busy?"جارٍ المعالجة...":register?"إنشاء الحساب":"تسجيل الدخول"}</button>
 </form><p>{register?"لديك حساب؟":"جديد في المنصة؟"} <button type="button" className="secondary" onClick={()=>{setRegister(!register);setError("");setNotice("");}}>{register?"تسجيل الدخول":"إنشاء حساب"}</button></p>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="good" role="status">{notice}</p>}
 </section></main>;
}
