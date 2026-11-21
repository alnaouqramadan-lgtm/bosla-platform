"use client";
import {useState} from "react";
import {annualBalance,annualCurrencies,validAnnualPlan,type AnnualPlan,type AnnualItem,type Design} from "@/lib/strategy-design";
import type {StrategicPlan,StrategicGoal,OperationalActivity} from "@/lib/institutional-planning";

type Props={plan:StrategicPlan;data:Design;activities:OperationalActivity[];goals:StrategicGoal[];editable:boolean;busy:boolean;save:(data:Design)=>Promise<boolean>};
const money=(value:number)=>value.toLocaleString("ar",{maximumFractionDigits:3});
const statusLabels={within:"ضمن السقف",over:"تجاوز السقف",incomplete:"تقديرات غير مكتملة",no_ceiling:"السقف غير محدد"};
export default function AnnualPlanning(props:Props){
 const first=Number(props.plan.period_start.slice(0,4)),last=Number(props.plan.period_end.slice(0,4));
 const [year,setYear]=useState(first);
 const years=Array.from({length:last-first+1},(_,index)=>first+index);
 const [dirty,setDirty]=useState(false);
 return <section className="stack"><h3>التزامات الخطة السنوية</h3>
  <label>سنة التخطيط<select className="field" value={year} disabled={props.busy} onChange={e=>{
   if(dirty&&!window.confirm("توجد تعديلات سنوية غير محفوظة. هل تريد الانتقال إلى سنة أخرى؟"))return;
   setDirty(false);setYear(Number(e.target.value));
  }}>{years.map(y=><option key={y}>{y}</option>)}</select></label>
  <AnnualEditor key={year} {...props} year={year} markDirty={setDirty}/>
 </section>;
}
function AnnualEditor({plan,data,activities,goals,editable,busy,save,year,markDirty}:Props&{year:number;markDirty:(value:boolean)=>void}){
 const [draft,setDraft]=useState<AnnualPlan>(()=>data.annualPlans?.find(p=>p.year===year)??{year,ceilings:{},items:[]});
 const [error,setError]=useState("");
 const goalNames=new Map(goals.map(g=>[g.id,g.title]));
 const rows=new Map(activities.map(a=>[a.id,a]));
 const ids=new Set(draft.items.map(i=>i.activityId));
 const start=plan.period_start>year+"-01-01"?plan.period_start:year+"-01-01";
 const end=plan.period_end<year+"-12-31"?plan.period_end:year+"-12-31";
 const eligible=activities.filter(a=>(!a.planned_start||a.planned_start<=end)&&(!a.planned_end||a.planned_end>=start));
 function update(next:AnnualPlan){setDraft(next);markDirty(true);setError("");}
 function updateItem(id:string,changes:Partial<AnnualItem>){
  update({...draft,items:draft.items.map(i=>i.activityId===id?{...i,...changes}:i)});
 }
 return <form className="stack" onSubmit={async e=>{
  e.preventDefault();if(!editable||busy)return;
  if(!validAnnualPlan(draft)){setError("راجع المبالغ والعملات قبل الحفظ.");return;}
  if(await save({...data,annualPlans:[...(data.annualPlans??[]).filter(p=>p.year!==year),draft]}))markDirty(false);
 }}>
  {editable&&<fieldset disabled={busy}><legend>أنشطة مرشحة للسنة</legend>
   {eligible.length===0&&<p>أضف نشاطًا في تبويب الخطة التشغيلية أو راجع مواعيد الأنشطة.</p>}
   {eligible.filter(a=>!ids.has(a.id)).map(a=><p key={a.id}><button type="button" className="secondary" onClick={()=>{
    update({...draft,items:[...draft.items,{activityId:a.id,currency:a.currency_code,amount:null,resources:""}]});
   }}>إدراج {a.title}</button> · {goalNames.get(a.goal_id)}</p>)}
  </fieldset>}
  {draft.items.map(i=>{const a=rows.get(i.activityId);return <fieldset key={i.activityId} disabled={busy}>
   <legend>{a?.title??"نشاط لم يعد متاحًا"}</legend>
   {a&&<p>{goalNames.get(a.goal_id)} · المسؤول: {a.owner_name||"غير محدد"} · المدة: {a.planned_start||"؟"} — {a.planned_end||"؟"}</p>}
   {a&&!eligible.some(x=>x.id===a.id)&&<p>مواعيد النشاط الحالية خارج السنة المختارة.</p>}
   {editable?<><label>المخصص لهذه السنة ({i.currency})<input className="field" type="number" min="0" step="0.001" max="1000000000000" value={i.amount??""} onChange={e=>updateItem(i.activityId,{amount:e.target.value===""?null:Number(e.target.value)})}/></label>
    <label>الموارد البشرية والمادية المطلوبة<textarea className="field" maxLength={1000} value={i.resources} onChange={e=>updateItem(i.activityId,{resources:e.target.value})}/></label>
    <button className="secondary" type="button" onClick={()=>update({...draft,items:draft.items.filter(row=>row.activityId!==i.activityId)})}>استبعاد من مسودة هذه السنة</button></>:
    <p>المخصص: {i.amount===null?"غير مقدّر":money(i.amount)+" "+i.currency} · الموارد: {i.resources||"غير محددة"}</p>}
  </fieldset>;})}
  {!draft.items.length&&<p>لم تُدرج أنشطة لهذه السنة بعد.</p>}
  <h4>السقف المالي والمخصصات السنوية</h4>
  {annualCurrencies.filter(c=>editable||draft.ceilings[c]!==undefined||draft.items.some(i=>i.currency===c)).map(currency=>{
   const {committed,missing,balance,status}=annualBalance(draft,currency);
   return <div key={currency}>{editable?<label>السقف السنوي ({currency})<input disabled={busy} className="field" type="number" min="0" step="0.001" max="1000000000000" value={draft.ceilings[currency]??""} onChange={e=>{
    const ceilings={...draft.ceilings};if(e.target.value==="")delete ceilings[currency];else ceilings[currency]=Number(e.target.value);
    update({...draft,ceilings});
   }}/></label>:<strong>{currency} · السقف: {draft.ceilings[currency]===undefined?"غير محدد":money(draft.ceilings[currency]!)}</strong>}
   <p>المخصص المعلوم: {money(committed)} {currency} · {statusLabels[status]}
   {balance!==null&&" · "+(balance<0?"قيمة التجاوز: ":"المتبقي بعد المخصصات المعلومة: ")+money(Math.abs(balance))}
   {missing>0&&" · أنشطة دون تقدير: "+missing}</p></div>;
  })}
  {error&&<p role="alert">{error}</p>}
  {editable&&<button disabled={busy} className="primary">حفظ الخطة السنوية</button>}
 </form>;
}
