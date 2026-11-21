"use client";
import {useState} from "react";
import type {StrategicGoal} from "@/lib/institutional-planning";
import IssueTeamRatings from "./IssueTeamRatings";
import {criteria,weightedScore,decisionGoals,type Design} from "@/lib/strategy-design";

type Props={goals:StrategicGoal[];data:Design;editable:boolean;busy:boolean;save:(next:Design)=>Promise<boolean>};
const levels=[1,2,3,4,5];
export default function StrategyDecision({data,editable,busy,save,goals}:Props){
 const issues=data.issues??[],options=data.options??[];
 const [issueTitle,setIssueTitle]=useState("");
 const [links,setLinks]=useState<string[]>([]);
 const [ratings,setRatings]=useState([3,3,3]);
 const [optionTitle,setOptionTitle]=useState("");
 const [issueId,setIssueId]=useState("");
 const [internal,setInternal]=useState("");
 const [external,setExternal]=useState("");
 const [scores,setScores]=useState([3,3,3,3]);
 const weights=data.weights??[25,25,25,25];
 const [trial,setTrial]=useState(weights);
 const [choice,setChoice]=useState(data.decision?.optionId??"");
 const [goalIds,setGoalIds]=useState<string[]>(data.decision?.goalIds??[]);
 const [reason,setReason]=useState(data.decision?.reason??"");
 const [assumption,setAssumption]=useState(data.decision?.assumption??"");
 const internalFactors=data.factors.filter(f=>["قوة","ضعف"].includes(f.quadrant));
 const externalFactors=data.factors.filter(f=>["فرصة","تهديد"].includes(f.quadrant));
 const numberFields=(labels:string[],values:number[],change:(v:number[])=>void)=>labels.map((label,i)=>
  <label key={label}>{label}<select className="field" value={values[i]} onChange={e=>change(values.map((v,j)=>i===j?Number(e.target.value):v))}>{levels.map(n=><option key={n}>{n}</option>)}</select></label>);
 const selected=options.find(o=>o.id===data.decision?.optionId);
 const text=(id:string)=>data.factors.find(f=>f.id===id)?.statement??"";
 return <>
  <h3>القضايا الاستراتيجية</h3>
  {issues.map(i=><article key={i.id}><strong>{i.title}</strong><p>الأثر {i.impact}/5 · الإلحاح {i.urgency}/5 · قوة الأدلة {i.confidence}/5</p><ul>{i.factorIds.map(id=><li key={id}>{text(id)}</li>)}</ul>
   <IssueTeamRatings issue={i} editable={editable} busy={busy} onSave={updated=>save({...data,issues:issues.map(row=>row.id===updated.id?updated:row)})}/>
  </article>)}
  {editable&&data.factors.length>0&&<details><summary>صياغة قضية من العوامل</summary><form className="stack" onSubmit={async e=>{
   e.preventDefault();if(!issueTitle.trim()||!links.length)return;
   if(await save({...data,issues:[...issues,{id:crypto.randomUUID(),title:issueTitle.trim(),factorIds:links,impact:ratings[0],urgency:ratings[1],confidence:ratings[2]}]})){setIssueTitle("");setLinks([]);}
  }}>
   <label>ما السؤال الذي يحتاج إلى قرار؟<input required className="field" maxLength={400} value={issueTitle} onChange={e=>setIssueTitle(e.target.value)}/></label>
   <fieldset><legend>العوامل المرتبطة بالقضية</legend>{data.factors.map(f=><label key={f.id}><input type="checkbox" checked={links.includes(f.id)} onChange={e=>setLinks(e.target.checked?[...links,f.id]:links.filter(x=>x!==f.id))}/>{f.statement}</label>)}</fieldset>
   {numberFields(["الأثر","الإلحاح","قوة الأدلة"],ratings,setRatings)}
   <button className="primary" disabled={busy||!links.length}>حفظ القضية</button>
  </form></details>}
  <h3>بدائل TOWS والمفاضلة</h3>
  {editable&&issues.length>0&&<details><summary>صياغة بديل استراتيجي</summary>
   {!internalFactors.length||!externalFactors.length?<p>أضف عاملًا داخليًا وعاملًا خارجيًا إلى SWOT لصياغة بديل.</p>:<form className="stack" onSubmit={async e=>{
    e.preventDefault();if(!optionTitle.trim())return;
    if(await save({...data,options:[...options,{id:crypto.randomUUID(),title:optionTitle.trim(),issueId,internalId:internal,externalId:external,scores}]}))setOptionTitle("");
   }}>
    <label>القضية<select className="field" required value={issueId} onChange={e=>setIssueId(e.target.value)}><option value="">اختر قضية</option>{issues.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label>
    <label>العامل الداخلي<select required className="field" value={internal} onChange={e=>setInternal(e.target.value)}><option value="">اختر العامل</option>{internalFactors.map(f=><option key={f.id} value={f.id}>{f.quadrant} · {f.statement}</option>)}</select></label>
    <label>العامل الخارجي<select required className="field" value={external} onChange={e=>setExternal(e.target.value)}><option value="">اختر العامل</option>{externalFactors.map(f=><option key={f.id} value={f.id}>{f.quadrant} · {f.statement}</option>)}</select></label>
    <label>وصف البديل<input required className="field" maxLength={500} value={optionTitle} onChange={e=>setOptionTitle(e.target.value)}/></label>
    <p>قيّم كل معيار من 1 إلى 5. الدرجة الأعلى أفضل.</p>{numberFields(criteria,scores,setScores)}
    <button className="primary" disabled={busy}>حفظ البديل وتقييمه</button>
   </form>}
  </details>}
  {options.length>0&&<>
   <details><summary>أوزان المفاضلة واختبار الحساسية</summary><p>غيّر الأوزان لمشاهدة أثرها في الدرجات قبل الحفظ.</p>
    {criteria.map((c,i)=><label key={c}>{c}<input type="number" min={0} max={100} value={trial[i]} className="field" onChange={e=>setTrial(trial.map((v,j)=>j===i?Math.max(0,Math.min(100,Number(e.target.value))):v))}/></label>)}
    {editable&&<button type="button" disabled={busy||trial.every(x=>x===0)} onClick={()=>void save({...data,weights:trial})}>حفظ الأوزان</button>}
   </details>
   {issues.map(issue=><section key={issue.id}><h4>{issue.title}</h4>{options.filter(o=>o.issueId===issue.id).map(o=><article key={o.id}>
    <strong>{o.title}</strong><p>{text(o.internalId)} × {text(o.externalId)}</p>
    <p>الدرجة المرجحة {weightedScore(o.scores,weights)?.toFixed(2)} / 5 · بالأوزان التجريبية {weightedScore(o.scores,trial)?.toFixed(2)??"غير محددة"}</p>
   </article>)}</section>)}
   <h3>مذكرة الاختيار الاستراتيجي</h3>
   {selected&&<article><strong>{selected.title}</strong><p>{data.decision?.reason}</p><p>الافتراض المطلوب مراجعته: {data.decision?.assumption||"غير مسجل"}</p></article>}
   {!editable&&data.decision&&<p>الأهداف المرتبطة: {decisionGoals(data.decision,goals).linked.map(g=>[g.code,g.title].filter(Boolean).join(" ")).join("، ")||"لم تُحدّد أهداف متاحة"}</p>}
   {editable&&<form className="stack" onSubmit={e=>{e.preventDefault();if(reason.trim())void save({...data,decision:{optionId:choice,reason:reason.trim(),assumption:assumption.trim(),goalIds:goals.filter(g=>goalIds.includes(g.id)).map(g=>g.id)}});}}>
    <label>البديل الموصى به<select required className="field" value={choice} onChange={e=>{setChoice(e.target.value);setGoalIds(e.target.value===data.decision?.optionId?data.decision.goalIds??[]:[]);}}><option value="">اختر البديل</option>{options.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
    <label>أسباب الاختيار<textarea required className="field" maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <label>افتراض مؤثر في القرار<textarea className="field" maxLength={1000} value={assumption} onChange={e=>setAssumption(e.target.value)}/></label>
    <fieldset><legend>الأهداف التي تترجم هذا الاختيار</legend>
     {goals.length===0&&<p>يمكن حفظ التوصية الآن، ثم إضافة أهداف من تبويب الأهداف وربطها هنا.</p>}
     {goals.map(g=><label key={g.id}><input type="checkbox" checked={goalIds.includes(g.id)} onChange={e=>setGoalIds(ids=>e.target.checked?[...ids,g.id]:ids.filter(id=>id!==g.id))}/>{g.code} {g.title}</label>)}
    </fieldset>
    <button className="primary" disabled={busy}>حفظ مذكرة الاختيار للمراجعة</button>
   </form>}
  </>}
 </>;
}
