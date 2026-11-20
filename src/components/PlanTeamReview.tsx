"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {supabase} from "@/lib/supabase";
import type {StrategicPlan} from "@/lib/institutional-planning";

export type PlanAccessRole="owner"|"editor"|"reviewer"|"viewer";
type Member={id:string;plan_id:string;user_id:string;member_email:string;role:Exclude<PlanAccessRole,"owner">;assigned_at:string};
type Event={id:string;actor_id:string;action:"submitted"|"approved"|"returned"|"reopened";note:string;created_at:string};
type Props={plan:StrategicPlan;role:PlanAccessRole;onReload:()=>Promise<void>};
const labels:Record<PlanAccessRole,string>={owner:"مالك المؤسسة",editor:"محرر الخطة",reviewer:"مراجع مستقل",viewer:"مشاهد"};
const actions:Record<Event["action"],string>={submitted:"أُرسلت للمراجعة",approved:"وافق المراجع",returned:"أعادها المراجع للتعديل",reopened:"أعادها المالك إلى المسودة"};
const statuses:Record<StrategicPlan["status"],string>={
 draft:"مسودة قابلة للتحرير",in_review:"بانتظار قرار المراجع",reviewed:"مراجَعة وجاهزة للاعتماد النهائي",approved:"معتمدة ومقفلة"
};
const err=(e:unknown)=>e instanceof Error?e.message:String(e);

export default function PlanTeamReview({plan,role,onReload}:Props){
 const [members,setMembers]=useState<Member[]>([]);
 const [events,setEvents]=useState<Event[]>([]);
 const [email,setEmail]=useState("");
 const [memberRole,setMemberRole]=useState<Exclude<PlanAccessRole,"owner">>("editor");
 const [reviewNote,setReviewNote]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  const [a,b]=await Promise.all([
   supabase.from("planning_plan_members")
    .select("id,plan_id,user_id,member_email,role,assigned_at").eq("plan_id",plan.id).order("assigned_at"),
   supabase.from("planning_plan_review_history")
    .select("id,actor_id,action,note,created_at").eq("plan_id",plan.id).order("created_at",{ascending:false})
  ]);
  if(a.error)throw a.error;
  if(b.error)throw b.error;
  setMembers((a.data??[]) as Member[]);
  setEvents((b.data??[]) as Event[]);
 },[plan.id]);
 useEffect(()=>{void load().catch(e=>setError(err(e)));},[load]);
 const isOwner=role==="owner";
 const canReport=role==="owner"||role==="editor";
 const hasReviewer=members.some(m=>m.role==="reviewer");
 async function run(call:()=>Promise<{error:unknown}>,success:string){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await call();
   if(result.error)throw result.error;
   await onReload();
   await load();
   setNotice(success);
  }catch(e){setError(err(e));}finally{setBusy(false);}
 }
 function add(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!isOwner||plan.status!=="draft")return;
  void run(()=>supabase.rpc("planning_assign_plan_member",{
   p_plan:plan.id,p_email:email.trim(),p_role:memberRole
  }),"أُضيف العضو إلى فريق هذه الخطة فقط.").then(()=>setEmail(""));
 }
 function remove(member:Member){
  if(!isOwner||plan.status!=="draft"||!window.confirm("إلغاء وصول هذا العضو إلى الخطة؟"))return;
  void run(()=>supabase.rpc("planning_remove_plan_member",{p_plan:plan.id,p_user:member.user_id}),
   "أُلغيت عضوية المستخدم في الخطة.");
 }
 function sendForReview(){
  if(!canReport||plan.status!=="draft")return;
  if(!window.confirm("سيُقفل تحرير المسودة حتى يصدر قرار المراجع. هل تريد الإرسال؟"))return;
  void run(()=>supabase.rpc("planning_send_plan_for_review",{p_plan:plan.id}),"أُرسلت الخطة إلى المراجع المستقل.");
 }
 function review(decision:"approve"|"return"){
  if(role!=="reviewer"||plan.status!=="in_review")return;
  if(decision==="return"&&reviewNote.trim().length<5){setError("اكتب سبب الإعادة (خمسة أحرف على الأقل).");return;}
  void run(()=>supabase.rpc("planning_review_plan",{
   p_plan:plan.id,p_decision:decision,p_note:reviewNote.trim()
  }),decision==="approve"?"تمت المراجعة، وتنتظر الخطة الاعتماد النهائي من مالك المؤسسة.":"أُعيدت الخطة إلى المسودة مع ملاحظات المراجع.");
 }
 function reopen(){
  if(!isOwner||!["in_review","reviewed"].includes(plan.status))return;
  if(!window.confirm("ستعود الخطة إلى المسودة ويلزم تقديمها للمراجعة مجددًا. هل تتابع؟"))return;
  void run(()=>supabase.rpc("planning_reopen_plan",{p_plan:plan.id,p_note:reviewNote.trim()}),
   "أُعيد فتح المسودة، وسُجل القرار في سجل المراجعة.");
 }
 function publish(){
  if(!isOwner||busy||plan.status==="approved")return;
  if(!window.confirm("سيتم إقفال الخطة وحفظ نسخة مرجعية ثابتة. هل تعتمدها نهائيًا؟"))return;
  void run(()=>supabase.rpc("planning_publish_plan",{p_plan:plan.id}),
   "اعتمد مالك المؤسسة الخطة نهائيًا، وحُفظ خط الأساس.");
 }
 return <div className="stack" aria-label="فريق التخطيط والاعتماد">
  <p><strong>حالة الخطة:</strong> {statuses[plan.status]} • <strong>صلاحيتك:</strong> {labels[role]}</p>
  {error&&<p role="alert" className="error">{error}</p>}
  {notice&&<p role="status" className="good">{notice}</p>}
  {isOwner&&<div className="institutional-followup-panel">
   <h3>فريق التخطيط وصلاحياته</h3>
   <p className="muted">تُضاف الحسابات المسجلة سابقًا في بوصلة إلى هذه الخطة فقط. لا يمنح ذلك صلاحية إدارة الورش أو إضافة مشاركين إليها.</p>
   {plan.status==="draft"&&<form className="institutional-form" onSubmit={add}>
    <label>البريد الإلكتروني للمستخدم<input type="email" className="field" required maxLength={254}
      value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@example.com"/></label>
    <label>دوره في الخطة<select className="field" value={memberRole}
      onChange={e=>setMemberRole(e.target.value as Exclude<PlanAccessRole,"owner">)}>
      <option value="editor">محرر — يعدل المسودة ويسجل الإنجازات</option>
      <option value="reviewer">مراجع — يقرر قبول المسودة أو إعادتها</option>
      <option value="viewer">مشاهد — يطّلع على الخطة والتقارير</option>
    </select></label>
    <button className="primary" disabled={busy}>إضافة العضو / تحديث دوره</button>
   </form>}
   <div className="institutional-records">{members.map(m=><article className="institutional-record" key={m.id}>
    <div><strong>{m.member_email}</strong><p>{labels[m.role]}</p></div>
    {plan.status==="draft"&&<button className="secondary" type="button" disabled={busy}
     onClick={()=>remove(m)}>إلغاء الصلاحية</button>}
   </article>)}</div>
   {!members.length&&<p className="muted">لم يُعيَّن أعضاء بعد. يمكنك اعتماد الخطة مباشرةً بصفتك المالك إذا لم يُعيَّن مراجع مستقل.</p>}
   {plan.status==="draft"&&hasReviewer&&<p className="muted">عند تعيين مراجع مستقل يصبح قراره شرطًا قبل اعتماد المالك النهائي. يُسمح بمراجع واحد لكل خطة في هذه المرحلة.</p>}
  </div>}
  {plan.status==="draft"&&canReport&&<div className="institutional-followup-panel">
   <h3>إحالة المسودة إلى المراجعة</h3>
   <p className="muted">تأكد من الرؤية والرسالة والأهداف والأنشطة والمؤشرات. عند الإحالة يُقفل تعديل المسودة لحين قرار المراجع.</p>
   <div className="institutional-actions">
    {(hasReviewer||!isOwner)&&<button className="primary" type="button" disabled={busy} onClick={sendForReview}>
      إرسال إلى المراجع</button>}
    {isOwner&&!hasReviewer&&<button className="primary" type="button" disabled={busy} onClick={publish}>
      اعتماد نهائي دون مراجع معيّن</button>}
   </div>
  </div>}
  {plan.status==="in_review"&&<div className="institutional-followup-panel">
   <h3>مرحلة المراجعة المستقلة</h3>
   <p className="muted">المسودة مقفلة الآن. يمكن للمراجع الاطلاع على جميع بنود الخطة ثم إصدار قرار.</p>
   {role==="reviewer"&&<div className="stack">
    <label>ملاحظات المراجع<textarea className="field" rows={3} maxLength={2000}
      value={reviewNote} onChange={e=>setReviewNote(e.target.value)}
      placeholder="سبب إعادة الخطة أو ملاحظات الموافقة"/></label>
    <div className="institutional-actions">
     <button className="primary" disabled={busy} onClick={()=>review("approve")}>قبول المراجعة</button>
     <button className="secondary" disabled={busy} onClick={()=>review("return")}>إعادة للتعديل</button>
    </div>
   </div>}
   {isOwner&&<button type="button" className="secondary" disabled={busy} onClick={reopen}>سحب الخطة وإعادة فتح المسودة</button>}
  </div>}
  {plan.status==="reviewed"&&<div className="institutional-followup-panel">
   <h3>قرار الاعتماد النهائي</h3>
   <p className="good">أقرّ المراجع المسودة. لا تُعد الخطة معتمدة إلا بعد قرار المالك.</p>
   {isOwner&&<div className="institutional-actions">
    <button className="primary" disabled={busy} onClick={publish}>اعتماد الخطة ونشر خط الأساس</button>
    <button className="secondary" disabled={busy} onClick={reopen}>إعادتها للتحرير</button>
   </div>}
  </div>}
  <details>
   <summary>سجل قرارات المراجعة ({events.length})</summary>
   <div className="institutional-records">{events.map(event=><article className="institutional-record" key={event.id}>
    <div><strong>{actions[event.action]}</strong>
     <p>{new Date(event.created_at).toLocaleString("ar")} • {event.actor_id===plan.created_by?
       "مالك المؤسسة":members.find(m=>m.user_id===event.actor_id)?.member_email??"عضو فريق التخطيط"}</p>
     {event.note&&<p>{event.note}</p>}
    </div>
   </article>)}</div>
   {!events.length&&<p className="muted">لا توجد قرارات مسجلة بعد.</p>}
  </details>
 </div>;
}
