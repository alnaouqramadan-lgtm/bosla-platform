"use client";
import {useState,type FormEvent} from "react";
import {supabase} from "@/lib/supabase";
import type {StrategicGoal} from "@/lib/institutional-planning";
import StrategyDecision from "./StrategyDecision";
import {methods,quadrants,readDesign,prepareWorkshop,sectorPreparation,type Factor,type Method,type Design} from "@/lib/strategy-design";

const blankFactor=():Factor=>({id:"",method:"PESTEL",category:"سياسي",statement:"",quadrant:"فرصة",source:"",date:""});

export default function StrategyDesign({planId,initial,stamp,editable,onSaved,goals}:{
 goals:StrategicGoal[];planId:string;initial:unknown;stamp:string;editable:boolean;onSaved:(next:Design,time:string)=>void
}){
 const [data,setData]=useState<Design|null>(()=>{try{return readDesign(initial);}catch{return null;}});
 const [timestamp,setTimestamp]=useState(stamp);
 const [factor,setFactor]=useState(blankFactor);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [route,setRoute]=useState(data?.route??"");
 const [sector,setSector]=useState(data?.sector??"");
 const [duration,setDuration]=useState(data?.duration??"");
 const [minutes,setMinutes]=useState(data?.workshopMinutes?.toString()??"");
 const workshop=prepareWorkshop(route,sector,minutes?Number(minutes):undefined);
 if(!data)return <p role="alert">تعذّر قراءة سجل تحليل هذه الخطة. يرجى مراجعة النسخة المحفوظة.</p>;
 async function save(next:Design){
  if(!editable||busy)return false;
  setBusy(true);setMessage("");
  try{
   const result=await supabase.from("planning_strategic_plans").update({strategy_design:next})
    .eq("id",planId).eq("status","draft").eq("updated_at",timestamp).select("updated_at").maybeSingle();
   if(result.error)throw new Error(result.error.message);
   if(!result.data)throw new Error("تغيرت الخطة أو صلاحية التحرير. انسخ مدخلاتك ثم أعد تحميل الصفحة لمراجعة آخر نسخة.");
   onSaved(next,result.data.updated_at);setTimestamp(result.data.updated_at);setData(next);setMessage("تم الحفظ في الخطة.");return true;
  }catch(e){setMessage(e instanceof Error?e.message:"تعذّر الحفظ.");return false;}
  finally{setBusy(false);}
 }
 async function saveFactor(e:FormEvent){
  e.preventDefault();if(!data)return;
  const item={...factor,id:factor.id||crypto.randomUUID(),statement:factor.statement.trim(),source:factor.source.trim()};
  if(!item.statement){setMessage("أدخل وصف العامل.");return;}
  const factors=factor.id?data.factors.map(f=>f.id===factor.id?item:f):[...data.factors,item];
  if(await save({...data,factors}))setFactor(blankFactor());
 }
 return <section className="card institutional-card stack">
  <h2>بناء الاستراتيجية وتحليل البيئة</h2>
  {editable?<form className="stack" onSubmit={e=>{e.preventDefault();void save({...data,route,sector:sector.trim(),duration:duration.trim(),workshopMinutes:minutes?Number(minutes):undefined});}}>
   <label>مسار المؤسسة<select className="field" required value={route} onChange={e=>setRoute(e.target.value)}><option value="">اختر المسار</option>{["تحديث استراتيجية قائمة","بناء استراتيجية جديدة"].map(x=><option key={x}>{x}</option>)}</select></label>
   <label>القطاع<input className="field" value={sector} list="workshop-sectors" maxLength={150} onChange={e=>setSector(e.target.value)}/></label>
   <datalist id="workshop-sectors">{Object.keys(sectorPreparation).map(s=><option key={s} value={s}/>)}</datalist>
   <label>أيام الورشة أو مواعيدها<input className="field" value={duration} placeholder="مثلاً يومان" maxLength={100} onChange={e=>setDuration(e.target.value)}/></label>
   <label>دقائق العمل الفعلية في الورشة بعد خصم الاستراحات<input className="field" type="number" min={4} max={10080} step={1} value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>
   <button disabled={busy} className="primary">حفظ إعدادات الورشة</button>
  </form>:<p>{[data.route,data.sector,data.duration].filter(Boolean).join(" • ")}</p>}
  {route&&<details open><summary>جدول الورشة المقترح</summary><p>{workshop.preparation}</p><p>{workshop.sectorQuestion}</p>
   <ol>{workshop.sessions.map(session=><li key={session.title}><strong>{session.title}</strong>
    {session.minutes!==null&&<span> · {session.minutes} دقيقة</span>}<p>المخرج المطلوب: {session.output}</p></li>)}</ol></details>}
  <h3>سجل العوامل والأدلة</h3>
  {editable&&<form className="stack" onSubmit={saveFactor}>
   <label>المنهجية<select className="field" value={factor.method} onChange={e=>{const method=e.target.value as Method;setFactor({...factor,method,category:methods[method][0]});}}>{Object.keys(methods).map(x=><option key={x}>{x}</option>)}</select></label>
   <label>مجال التحليل<select className="field" value={factor.category} onChange={e=>setFactor({...factor,category:e.target.value})}>{methods[factor.method].map(x=><option key={x}>{x}</option>)}</select></label>
   <label>العامل وأثره المحتمل<textarea className="field" required maxLength={2000} value={factor.statement} onChange={e=>setFactor({...factor,statement:e.target.value})}/></label>
   <label>تصنيف SWOT<select className="field" value={factor.quadrant} onChange={e=>setFactor({...factor,quadrant:e.target.value})}>{quadrants.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>مصدر الدليل<input className="field" maxLength={500} value={factor.source} onChange={e=>setFactor({...factor,source:e.target.value})} placeholder="اسم الدراسة أو محضر اللقاء"/></label>
   <label>تاريخ الدليل<input className="field" type="date" value={factor.date} onChange={e=>setFactor({...factor,date:e.target.value})}/></label>
   <button className="primary" disabled={busy}>{factor.id?"حفظ تعديل العامل":"إضافة العامل إلى التحليل"}</button>
   {factor.id&&<button type="button" disabled={busy} onClick={()=>setFactor(blankFactor())}>إلغاء التعديل</button>}
  </form>}
  <p role="status">{message}</p>
  <h3>مصفوفة SWOT المستخلصة من السجل</h3>
  {quadrants.map(q=><section key={q}><h4>{q}</h4>
   {data.factors.some(f=>f.quadrant===q)?<ul>{data.factors.filter(f=>f.quadrant===q).map(f=><li key={f.id}>
    <strong>{f.statement}</strong><p>{f.method} · {f.category} · {f.source||"رأي يحتاج إلى مصدر"} {f.date}</p>
    {editable&&<button type="button" className="secondary" disabled={busy} onClick={()=>setFactor({...f})}>تعديل العامل</button>}
   </li>)}</ul>:<p className="muted">لم تُسجّل عوامل بعد.</p>}
  </section>)}
  <StrategyDecision goals={goals} data={data} busy={busy} editable={editable} save={save}/>
 </section>;
}
