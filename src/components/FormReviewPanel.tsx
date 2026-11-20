"use client";
import {useState} from "react";
import {supabase} from "@/lib/supabase";
import {STAGES} from "@/lib/stages";
import type {Answer,Group} from "@/lib/types";
import type {FormReview} from "@/lib/form-review";

type Draft={content:string;answer_id?:string;source_time?:string;group_name?:string;source_text?:string};
type Props={
 workshopId:string;stage:number;active:boolean;groups:Group[];answers:Answer[];
 review?:FormReview;onSaved:(review:FormReview)=>void;
};
export default function FormReviewPanel({workshopId,stage,active,groups,answers,review,onSaved}:Props){
 const [drafts,setDrafts]=useState<Record<string,Draft>>({});
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [conflict,setConflict]=useState(false);
 const fields=STAGES[stage-1].fields;
 const approved=fields.filter(f=>review?.fields[f.key]?.status==="approved").length;
 const locked=!active||!!review?.finalized_at||busy||conflict;
 function change(key:string,draft:Draft){setDrafts(prev=>({...prev,[key]:draft}));setMessage("");}
 async function save(action:"draft"|"approve"|"finalize",key?:string){
  if(locked)return;
  const draft=key?(drafts[key]??review?.fields[key]):undefined;
  setBusy(true);setMessage("");
  try{
   const result=await supabase.rpc("planning_save_form_review",{
    p_workshop:workshopId,p_stage:stage,p_revision:review?.revision??0,p_action:action,
    p_key:key??null,p_content:draft?.content??null,p_answer:draft?.answer_id??null,p_source_time:draft?.source_time??null
   }).single();
   if(result.error){if(result.error.message.includes("تغيّرت"))setConflict(true);throw result.error;}
   onSaved(result.data as FormReview);
   if(key)setDrafts(prev=>{const next={...prev};delete next[key];return next;});
   setMessage(action==="finalize"?"تم اعتماد النموذج كاملًا.":action==="approve"?"تم اعتماد إجابة الخانة.":"تم حفظ المسودة.");
  }catch(e){setMessage(typeof e==="object"&&e&&"message" in e?String(e.message):"تعذّر الحفظ. حاول مجددًا.");}
  finally{setBusy(false);}
 }
 return <section className="card no-print"><h2>مراجعة إجابات المجموعات</h2>
 <p>{review?.finalized_at?"النموذج معتمد":"الخانات المعتمدة"} · {approved} / {fields.length}</p>
 {fields.map(f=>{
  const saved=review?.fields[f.key];
  const draft=drafts[f.key]??saved??{content:""};
  return <details key={f.key}><summary>{f.title} — {drafts[f.key]?"تعديل غير محفوظ":saved?.status==="approved"?"معتمدة":saved?"مسودة محفوظة":"بانتظار المراجعة"}</summary>
  <div className="stack">{groups.map(g=>{
   const a=answers.find(a=>a.stage===stage&&a.field_key===f.key&&a.scope==="group"&&a.owner_id===g.id);
   return <article className="card" key={g.id}><strong>{g.name}</strong>
    <p style={{whiteSpace:"pre-wrap"}}>{a?.content.trim()||"بانتظار إجابة المجموعة"}</p>
    {a?.content.trim()&&<><small>آخر حفظ {new Date(a.updated_at).toLocaleString("ar")}</small>{" "}
    {!review?.finalized_at&&<button className="secondary" disabled={locked} onClick={()=>change(f.key,{content:a.content,answer_id:a.id,source_time:a.updated_at,source_text:a.content,group_name:g.name})}>تبنَّ إجابة {g.name}</button>}</>}
   </article>;
  })}</div>
  <label>صياغة الميسّر<textarea className="field" rows={3} value={draft.content} maxLength={30000} disabled={locked}
   onChange={e=>change(f.key,{...draft,content:e.target.value})}/></label>
  {draft.group_name&&<details><summary>النص المتبنّى من {draft.group_name}</summary><p style={{whiteSpace:"pre-wrap"}}>{draft.source_text}</p></details>}
  {!review?.finalized_at&&<div className="toolbar"><button className="secondary" disabled={locked||!drafts[f.key]?.content.trim()} onClick={()=>void save("draft",f.key)}>حفظ المسودة</button>
   <button className="primary" disabled={locked||!draft.content.trim()||(!drafts[f.key]&&saved?.status==="approved")} onClick={()=>void save("approve",f.key)}>اعتماد إجابة الخانة</button></div>}
  </details>;
 })}
 {approved>0&&<details><summary>مراجعة الصياغات المعتمدة</summary>{fields.map(f=>review?.fields[f.key]?.status==="approved"&&<article key={f.key}><strong>{f.title}</strong><p style={{whiteSpace:"pre-wrap"}}>{review.fields[f.key].content}</p></article>)}</details>}
 {!review?.finalized_at&&<button className="primary" disabled={locked||approved!==fields.length||Object.keys(drafts).length>0} onClick={()=>void save("finalize")}>اعتماد النموذج نهائيًا</button>}
 {message&&<p role="status">{message}</p>}{conflict&&<button onClick={()=>window.location.reload()}>إعادة تحميل النسخة المحفوظة</button>}
 </section>;
}
