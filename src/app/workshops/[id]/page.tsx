"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import FormReviewPanel from "@/components/FormReviewPanel";
import WorksheetPrint from "@/components/WorksheetPrint";
import {reviewSource,type FormReview} from "@/lib/form-review";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import {supabase} from "@/lib/supabase";
import {STAGES,normalizeLine,fieldName} from "@/lib/stages";
import {exportWorkbook,groupRepeated} from "@/lib/export";
import type {Workshop,Group,Participant,Answer,Priority,Vote} from "@/lib/types";

function err(e:unknown):string {return e instanceof Error?e.message:String(e&&typeof e==="object"&&"message" in e?(e as {message:unknown}).message:e);}
function draftKey(stage:number,field:string,scope:string,owner:string){return [stage,field,scope,owner].join("|");}

type StageDecision={stage:number;content:string;decided_by:string;revision:number};
function roleLabel(facilitator:boolean,recorder:boolean,inGroup:boolean){
 if(facilitator)return recorder?"ميسّر الورشة ومقرّر المجموعة":"ميسّر الورشة";
 if(recorder)return "مقرّر المجموعة";
 return inGroup?"عضو في المجموعة":"مشارك بانتظار التوزيع";
}

export default function WorkshopPage(){
 const {id}=useParams<{id:string}>();const router=useRouter();
 const[userId,setUserId]=useState("");const[workshop,setWorkshop]=useState<Workshop|null>(null);
 const[organizationName,setOrganizationName]=useState("");
 const[groups,setGroups]=useState<Group[]>([]);const[participants,setParticipants]=useState<Participant[]>([]);
 const[answers,setAnswers]=useState<Answer[]>([]);const[priorities,setPriorities]=useState<Priority[]>([]);const[votes,setVotes]=useState<Vote[]>([]);
 const[drafts,setDrafts]=useState<Record<string,string>>({});const[saveStatus,setSaveStatus]=useState<Record<string,string>>({});
 const[timers]=useState(()=>({current:{} as Record<string,ReturnType<typeof setTimeout>>}));
 const[stage,setStage]=useState(1);const[scope,setScope]=useState<"group"|"individual">("group");
 const[selectedGroup,setSelectedGroup]=useState("");const[groupName,setGroupName]=useState("");
 const[platformAdmin,setPlatformAdmin]=useState(false);
 const[participantEmail,setParticipantEmail]=useState("");const[participantPhone,setParticipantPhone]=useState("");
 const[whatsAppUrl,setWhatsAppUrl]=useState("");
 const[showResults,setShowResults]=useState(false);const[busy,setBusy]=useState(false);const[loading,setLoading]=useState(true);
 const[error,setError]=useState("");const[notice,setNotice]=useState("");

 const [adminIds,setAdminIds]=useState<string[]>([]);
 const [decisions,setDecisions]=useState<StageDecision[]>([]);
 const [reviews,setReviews]=useState<FormReview[]>([]);
 const [loadStep,setLoadStep]=useState("فتح صفحة الورشة");
 const [slowLoad,setSlowLoad]=useState(false);
 const load=useCallback(async()=>{
  setLoadStep("التحقق من تسجيل الدخول");
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError||!auth.user){router.replace("/login?next="+encodeURIComponent(window.location.pathname+window.location.search));return;}
  const uid=auth.user.id;setUserId(uid);
  setLoadStep("التحقق من صلاحيات الحساب");
  const adminResult=await supabase.rpc("planning_is_platform_admin");
  if(adminResult.error)throw adminResult.error;
  setPlatformAdmin(adminResult.data===true);
  const preferredName=String(auth.user.user_metadata?.full_name || auth.user.email?.split("@")[0] || "مشارك");
  const name=preferredName.trim().length>=2?preferredName.trim().slice(0,120):"مشارك";
  setLoadStep("تحميل الملف الشخصي");
  const ownProfile=await supabase.from("planning_profiles").upsert({id:uid,full_name:name},{onConflict:"id"});
  if(ownProfile.error)throw ownProfile.error;
  if(new URLSearchParams(window.location.search).has("code")){
   window.history.replaceState(null,"",window.location.pathname);
   setNotice("انتهت صلاحية روابط الدعوة العامة. يضيف مدير بوصلة المشاركين مباشرة.");
  }
  setLoadStep("تحميل بيانات الورشة");
  const w=await supabase.from("planning_workshops")
   .select("id,organization_id,title,planning_year,workshop_date,created_by,open_stages,allow_individual,vote_open,status")
   .eq("id",id).maybeSingle();
  if(w.error)throw w.error;
  if(!w.data){setWorkshop(null);return;}
  setWorkshop(w.data as Workshop);
  const orgResult=await supabase.from("planning_organizations").select("name")
   .eq("id",w.data.organization_id).maybeSingle();
  setOrganizationName(orgResult.data?.name??w.data.title);
  setLoadStep("تحميل المجموعات وإجابات الورشة");
  const queries=await Promise.all([
   supabase.from("planning_groups").select("id,organization_id,workshop_id,name").eq("workshop_id",id).order("name"),
   supabase.from("planning_participants").select("id,organization_id,workshop_id,user_id,group_id,workshop_role,is_recorder,display_name")
    .eq("workshop_id",id).order("created_at"),
   supabase.from("planning_answers").select("id,organization_id,workshop_id,stage,field_key,scope,owner_id,content,created_by,updated_by,updated_at")
    .eq("workshop_id",id),
   supabase.from("planning_priorities").select("id,organization_id,workshop_id,source_answer_id,label,normalized_label")
    .eq("workshop_id",id),
   supabase.from("planning_votes").select("id,organization_id,workshop_id,priority_id,user_id").eq("workshop_id",id),
   supabase.rpc("planning_workshop_admin_ids",{p_workshop:id}),
   supabase.from("planning_stage_decisions").select("stage,content,decided_by,revision").eq("workshop_id",id).order("stage"),
   supabase.from("planning_form_reviews").select("stage,fields,revision,finalized_at,finalized_by").eq("workshop_id",id).order("stage")
  ]);
  for(const q of queries)if(q.error)throw q.error;
  setReviews(queries[7].data??[]);
  setAdminIds(queries[5].data??[]);setDecisions(queries[6].data??[]);
  const gs=(queries[0].data??[]) as Group[];
  const as=(queries[2].data??[]) as Answer[];
  setGroups(gs);setParticipants((queries[1].data??[]) as Participant[]);setAnswers(as);
  setPriorities((queries[3].data??[]) as Priority[]);setVotes((queries[4].data??[]) as Vote[]);
  setSelectedGroup(prev=>gs.some(g=>g.id===prev)?prev:gs[0]?.id||"");
  setDrafts(prev=>{
   const copy={...prev};for(const a of as){const key=draftKey(a.stage,a.field_key,a.scope,a.owner_id);
    if(!(key in copy))copy[key]=a.content;
   }return copy;
  });
 },[id,router]);
 useEffect(()=>{
  let mounted=true;
  const timer=window.setTimeout(()=>setSlowLoad(true),15000);
  load().catch(e=>{if(mounted)setError(err(e));}).finally(()=>{window.clearTimeout(timer);if(mounted)setLoading(false);});
  return()=>{mounted=false;window.clearTimeout(timer);};
 },[load]);

 const assignableParticipants=participants.filter(p=>!adminIds.includes(p.user_id));
 const me=participants.find(p=>p.user_id===userId);
 const facilitator=!!workshop&&(workshop.created_by===userId||me?.workshop_role==="facilitator");
 const groupId=facilitator?selectedGroup:me?.group_id||"";
 const ownerId=scope==="group"?groupId:userId;
 const editable=!!workshop&&workshop.status==="active"&&(facilitator||workshop.open_stages.includes(stage))&&
  (scope==="individual"?(workshop.allow_individual||facilitator):!!groupId&&(facilitator||!!me?.is_recorder));
 const numberOfFields=STAGES.reduce((sum,s)=>sum+s.fields.length,0);
 const source=(a:Answer)=>a.scope==="group"?groups.find(g=>g.id===a.owner_id)?.name||"مجموعة":
  participants.find(p=>p.user_id===a.owner_id)?.display_name||"فردي";

 async function reload(){setError("");try{await load();}catch(e){setError(err(e));}}
 async function updateSettings(patch:Partial<Workshop>){if(!workshop||!facilitator||busy)return;
  setBusy(true);setError("");try{
   const r=await supabase.from("planning_workshops").update(patch)
    .eq("id",workshop.id).eq("organization_id",workshop.organization_id)
    .select("id,organization_id,title,planning_year,workshop_date,created_by,open_stages,allow_individual,vote_open,status").single();
   if(r.error)throw r.error;setWorkshop(r.data as Workshop);setNotice("تم حفظ إعدادات الورشة.");
  }catch(e){setError(err(e));}finally{setBusy(false);}
 }
 async function addGroup(){if(!workshop||!groupName.trim()||busy)return;setBusy(true);setError("");
  try{const r=await supabase.from("planning_groups").insert({organization_id:workshop.organization_id,workshop_id:id,name:groupName.trim()});
   if(r.error)throw r.error;setGroupName("");await reload();
  }catch(e){setError(err(e));}finally{setBusy(false);}}
 async function setParticipant(p:Participant,patch:Partial<Participant>){if(!facilitator||busy)return;
  setBusy(true);setError("");try{const r=await supabase.from("planning_participants").update(patch).eq("id",p.id);
   if(r.error)throw r.error;await reload();
  }catch(e){setError(err(e));}finally{setBusy(false);}}
 async function addParticipant(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!workshop||!platformAdmin||busy)return;
  const phone=participantPhone.replace(/[^0-9]/g,"");
  if(!/^[1-9][0-9]{7,14}$/.test(phone)){
   setError("أدخل رقم واتساب بصيغة دولية، مثل 970xxxxxxxxx، بدون صفر محلي في البداية.");
   return;
  }
  setBusy(true);setError("");setWhatsAppUrl("");
  try{
   const r=await supabase.rpc("planning_admin_add_participant",{
    p_workshop:id,p_email:participantEmail.trim().toLowerCase()
   });
   if(r.error)throw r.error;
   const link=window.location.origin+"/workshops/"+id;
   const message="مرحبًا، تمت إضافتك إلى ورشة "+workshop.title+" على بوصلة AI. سجّل الدخول بحسابك ثم افتح رابط الورشة: "+link;
   setWhatsAppUrl("https://wa.me/"+phone+"?text="+encodeURIComponent(message));
   setParticipantEmail("");setParticipantPhone("");
   await reload();
   setNotice("تمت إضافة المشارك. افتح واتساب أدناه واضغط إرسال؛ الرسالة لا تُرسل تلقائيًا.");
  }catch(e){setError(err(e));}finally{setBusy(false);}
 }
 async function save(field:string,text:string,s:number,sc:"group"|"individual",owner:string){
  if(!workshop||!owner||!userId)return;
  const key=draftKey(s,field,sc,owner);clearTimeout(timers.current[key]);
  setSaveStatus(p=>({...p,[key]:"جارٍ الحفظ..."}));
  try{
   const existing=answers.find(a=>a.stage===s&&a.field_key===field&&a.scope===sc&&a.owner_id===owner);
   const columns="id,organization_id,workshop_id,stage,field_key,scope,owner_id,content,created_by,updated_by,updated_at";
   const query=existing?supabase.from("planning_answers").update({content:text}).eq("id",existing.id):
    supabase.from("planning_answers").insert({organization_id:workshop.organization_id,
      workshop_id:id,stage:s,field_key:field,scope:sc,owner_id:owner,content:text,
      created_by:userId,updated_by:userId});
   const result=await query.select(columns).single();
   if(result.error)throw result.error;const saved=result.data as Answer;
   setAnswers(old=>[...old.filter(a=>a.id!==saved.id),saved]);
   setSaveStatus(p=>({...p,[key]:"تم الحفظ"}));
  }catch(e){setSaveStatus(p=>({...p,[key]:"فشل الحفظ: "+err(e)}));}
 }
 function edit(field:string,value:string){if(!editable||!ownerId)return;
  const s=stage,sc=scope,owner=ownerId,key=draftKey(s,field,sc,owner);
  setDrafts(p=>({...p,[key]:value}));setSaveStatus(p=>({...p,[key]:"تغييرات غير محفوظة..."}));
  clearTimeout(timers.current[key]);timers.current[key]=setTimeout(()=>void save(field,value,s,sc,owner),800);
 }
 function flush(field:string){if(!editable||!ownerId)return;
  const key=draftKey(stage,field,scope,ownerId);
  if(saveStatus[key]==="تغييرات غير محفوظة...")void save(field,drafts[key]||"",stage,scope,ownerId);
 }

 async function refreshVotes(){const [p,v]=await Promise.all([
  supabase.from("planning_priorities").select("id,organization_id,workshop_id,source_answer_id,label,normalized_label").eq("workshop_id",id),
  supabase.from("planning_votes").select("id,organization_id,workshop_id,priority_id,user_id").eq("workshop_id",id)
 ]);if(p.error)throw p.error;if(v.error)throw v.error;setPriorities((p.data||[]) as Priority[]);setVotes((v.data||[]) as Vote[]);}
 async function collectPriorities(){if(!workshop||!facilitator||busy)return;
  const combined=new Map<string,{label:string;source_answer_id:string}>();
  for(const a of answers){if(a.stage!==2||a.field_key!=="priorities")continue;
   for(const line of a.content.split(/\r?\n/)){const label=line.trim(),key=normalizeLine(label);
    if(label&&label.length<=500&&!combined.has(key))combined.set(key,{label,source_answer_id:a.id});
   }}
  if(!combined.size){setNotice("لا توجد قضايا مسجلة بعد.");return;}
  setBusy(true);setError("");try{
   const input=[...combined].map(([normalized_label,item])=>({organization_id:workshop.organization_id,
    workshop_id:id,normalized_label,...item,created_by:userId}));
   const r=await supabase.from("planning_priorities").upsert(input,
    {onConflict:"workshop_id,normalized_label",ignoreDuplicates:true});
   if(r.error)throw r.error;await refreshVotes();setNotice("تم جمع القضايا المتطابقة مع الاحتفاظ بإجابات الجميع.");
  }catch(e){setError(err(e));}finally{setBusy(false);}
 }
 async function vote(p:Priority){if(!workshop?.vote_open||busy)return;setBusy(true);setError("");
  try{const own=votes.find(v=>v.priority_id===p.id&&v.user_id===userId);
   const result=own?await supabase.from("planning_votes").delete().eq("id",own.id):
    await supabase.from("planning_votes").insert({organization_id:workshop.organization_id,
      workshop_id:id,priority_id:p.id,user_id:userId});
   if(result.error)throw result.error;await refreshVotes();
  }catch(e){setError(err(e));}finally{setBusy(false);}}
 async function excel(){if(!workshop||!facilitator||busy)return;setBusy(true);setError("");
  try{await exportWorkbook(workshop,answers,groups,participants,priorities,votes,decisions,reviews,organizationName);
   setNotice("تم تحضير Excel بالأوراق المصممة (1–3) لكل مجموعة، مع ملحق البيانات الأصلية.");
  }catch(e){setError(err(e));}finally{setBusy(false);}}

 if(loading)return <main className="wrap"><section className="card">
  <h1>جارٍ تحميل الورشة…</h1>
  <p role="status">{loadStep}</p>
  {slowLoad&&<p>استغرق الاتصال وقتًا أطول من المعتاد. يمكنك الانتظار أو إعادة المحاولة.</p>}
  <a href="">إعادة المحاولة</a> · <a href="/dashboard">العودة إلى لوحة التحكم</a>
 </section></main>;
 if(error&&!workshop)return <main className="wrap"><section className="card">
  <h1>تعذّر فتح الورشة</h1><p>{loadStep}</p><p role="alert">{error}</p>
  <a href="">إعادة المحاولة</a> · <a href="/dashboard">العودة إلى لوحة التحكم</a>
 </section></main>;
 if(!workshop)return <main className="wrap"><Link href="/dashboard">العودة</Link><section className="card">
 <h1>الورشة غير متاحة لهذا الحساب</h1>
 <p>ليس لديك صلاحية دخول هذه الورشة بعد. اطلب من مدير بوصلة إضافتك بحسابك المسجّل.</p>
 {error&&<p role="alert" className="error">{error}</p>}<Link href="/dashboard">فتح لوحة التحكم</Link>
 </section></main>;
 const grouped=facilitator?groupRepeated(answers,groups,participants):[];
 return <main className="wrap">
 <header className="toolbar no-print" style={{justifyContent:"space-between"}}>
 <Link href="/dashboard">العودة للورش</Link><span>{platformAdmin?"مدير المنصة":roleLabel(facilitator,!!me?.is_recorder,!!me?.group_id)}</span>
 </header>
 <h1 className="title">{workshop.title}</h1>
 <p className="muted">السنة: {workshop.planning_year} — التاريخ: {workshop.workshop_date}</p>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="good" role="status">{notice}</p>}
 {facilitator&&<section className="card no-print">
 <h2>{platformAdmin?"إدارة الورشة":"لوحة الميسر"}</h2>
 <div className="toolbar">
 <button className="secondary" disabled={busy} onClick={()=>void updateSettings({allow_individual:!workshop.allow_individual})}>
 الإدخال الفردي: {workshop.allow_individual?"مفعل":"غير مفعل"}</button>
 <button className="secondary" disabled={busy} onClick={()=>void updateSettings({vote_open:!workshop.vote_open})}>
 التصويت: {workshop.vote_open?"مفتوح":"مغلق"}</button>
 <button className="secondary" onClick={()=>void reload()}>تحديث البيانات</button>
 </div>
 <h3>المراحل المفتوحة</h3>
 <div className="toolbar">{STAGES.map((s,i)=><button key={i} disabled={busy} className="secondary"
  style={{background:workshop.open_stages.includes(i+1)?"#dcfce7":"#fee2e2"}}
  onClick={()=>void updateSettings({open_stages:workshop.open_stages.includes(i+1)?
   workshop.open_stages.filter(n=>n!==i+1):[...workshop.open_stages,i+1].sort()})}>
 {i+1}. {workshop.open_stages.includes(i+1)?"مفتوحة":"مغلقة"}</button>)}</div>
 <h3>إنشاء مجموعات العمل</h3>
 <div className="toolbar"><input className="field" style={{flex:"1 1 170px"}} placeholder="اسم المجموعة"
  value={groupName} onChange={e=>setGroupName(e.target.value)}/>
 <button className="primary" disabled={busy||!groupName.trim()} onClick={()=>void addGroup()}>إضافة مجموعة</button></div>
 <h3>المشاركون والدعوات عبر واتساب</h3>
 {platformAdmin&&<>
  <p className="muted">إضافة المشاركين مقتصرة على حساب مدير بوصلة المعتمد. يجب أن يمتلك المشارك حسابًا مؤكدًا مسبقًا في بوصلة. لن تُرسل أي رسالة بريد إلكتروني.</p>
  <form className="toolbar" onSubmit={e=>void addParticipant(e)}>
   <input className="field" type="email" required aria-label="بريد حساب المشارك" placeholder="بريد حساب المشارك المسجل"
    value={participantEmail} onChange={e=>setParticipantEmail(e.target.value)}/>
   <input className="field" type="tel" required inputMode="tel" aria-label="رقم واتساب الدولي" placeholder="رقم واتساب مع رمز الدولة"
    value={participantPhone} onChange={e=>setParticipantPhone(e.target.value)}/>
   <button type="submit" className="primary" disabled={busy||!participantEmail.trim()||!participantPhone.trim()}>إضافة المشارك</button>
  </form>
  {whatsAppUrl&&<p><a className="primary" href={whatsAppUrl} target="_blank" rel="noopener noreferrer">فتح واتساب وإرسال الدعوة</a></p>}
 </>}
 {!platformAdmin&&<p className="muted">مدير بوصلة وحده يضيف المشاركين. يمكن للميسر توزيع المشاركين المسجلين على المجموعات.</p>}
 {!assignableParticipants.length&&<p>لم تتم إضافة مشاركين بعد.</p>}
 <div className="stack">{assignableParticipants.map(p=><div key={p.id} className="toolbar" style={{borderBottom:"1px solid #e2e8f0",paddingBottom:10}}>
 <div style={{minWidth:145}}><strong>{p.display_name}</strong><div className="muted">{roleLabel(p.user_id===workshop.created_by||p.workshop_role==="facilitator",p.is_recorder,!!p.group_id)}</div></div>
 <select aria-label="مجموعة المشارك" className="field" style={{width:"auto"}} disabled={busy}
  value={p.group_id||""} onChange={e=>void setParticipant(p,{group_id:e.target.value||null,is_recorder:false})}>
 <option value="">غير موزّع</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>
 {p.group_id&&<label>الدور في المجموعة
 <select className="field" disabled={busy} value={p.is_recorder?"recorder":"member"}
  onChange={e=>void setParticipant(p,{is_recorder:e.target.value==="recorder"})}>
  <option value="member">عضو في المجموعة</option>
  <option value="recorder">مقرّر المجموعة</option>
 </select></label>}
 </div>)}</div>
 <h3>متابعة التقدم</h3>
 <div className="two-cols">{groups.map(g=>{
  const done=answers.filter(a=>a.scope==="group"&&a.owner_id===g.id&&a.content.trim()).length;
  return <div className="chip" key={g.id} style={{display:"block"}}><strong>{g.name}</strong>
   <p>{done} / {numberOfFields} حقلاً ({Math.round(done/numberOfFields*100)}%)</p>
   <progress value={done} max={numberOfFields} style={{width:"100%"}}/></div>;
 })}</div></section>}
 <nav className="card toolbar no-print" aria-label="مراحل التخطيط">
 {STAGES.map((s,i)=><button key={i} className={stage===i+1&&!showResults?"primary":"secondary"}
  onClick={()=>{setStage(i+1);setShowResults(false);}}>{i+1}. {s.name}</button>)}
 {facilitator&&<button className={showResults?"primary":"secondary"} onClick={()=>setShowResults(true)}>النتائج والتصدير</button>}
 </nav>
 {!showResults&&<section className="card no-print">
 <h2>{stage}. {STAGES[stage-1].name}</h2><p className="muted">{STAGES[stage-1].description}</p>
 <p className={workshop.open_stages.includes(stage)?"good":"error"}>المرحلة {workshop.open_stages.includes(stage)?"مفتوحة":"مغلقة"}</p>
 <div className="toolbar" style={{marginBottom:20}}>
 <button className={scope==="group"?"primary":"secondary"} onClick={()=>setScope("group")}>عمل المجموعة</button>
 {(workshop.allow_individual||facilitator)&&<button className={scope==="individual"?"primary":"secondary"} onClick={()=>setScope("individual")}>الإدخال الفردي</button>}
 {facilitator&&scope==="group"&&<select aria-label="المجموعة" className="field" style={{width:"auto"}}
  value={selectedGroup} onChange={e=>setSelectedGroup(e.target.value)}>
  {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>}
 </div>
 {scope==="group"&&!groupId&&<p className="error">يجب تعيين مجموعة أولاً.</p>}
 {scope==="group"&&groupId&&!editable&&<p className="muted">يمكن قراءة الإجابات، لكن تعديلها متاح فقط للمقرر أو الميسر عند فتح المرحلة.</p>}
 <div className="stack">{STAGES[stage-1].fields.map(f=>{
  const key=draftKey(stage,f.key,scope,ownerId);
  const value=drafts[key]??answers.find(a=>a.stage===stage&&a.field_key===f.key&&a.scope===scope&&a.owner_id===ownerId)?.content??"";
  return <label key={f.key}><strong style={{display:"block",marginBottom:7}}>{f.title}</strong>
  <textarea className="field" rows={3} disabled={!editable} maxLength={30000} placeholder=""
   value={value} onChange={e=>edit(f.key,e.target.value)} onBlur={()=>flush(f.key)}/>
  <small className={saveStatus[key]?.startsWith("فشل")?"error":"muted"} role="status">{saveStatus[key]||""}</small>
  </label>;
 })}</div>
 </section>}
 {facilitator&&!showResults&&<FormReviewPanel key={id+":"+stage} workshopId={id} stage={stage} active={workshop.status==="active"}
 facilitatorId={userId} groups={groups} answers={answers} review={reviews.find(r=>r.stage===stage)}
 onSaved={saved=>setReviews(prev=>[...prev.filter(r=>r.stage!==saved.stage),saved].sort((a,b)=>a.stage-b.stage))}/>}

 {stage===2&&!showResults&&<section className="card no-print">
 <h2>التصويت على القضايا ذات الأولوية</h2>
 {facilitator&&<button className="primary" disabled={busy} onClick={()=>void collectPriorities()}>جمع القضايا المتكررة</button>}
 <p className="muted">يجري تجميع العبارات المتطابقة نصيًا فقط، دون تغيير الإجابات الأصلية. يمكن للمشارك تسجيل صوت واحد على كل قضية.</p>
 {!priorities.length&&<p>لم تُنشر قضايا للتصويت بعد.</p>}
 {priorities.map(p=>{const count=votes.filter(v=>v.priority_id===p.id).length;
  const already=votes.some(v=>v.priority_id===p.id&&v.user_id===userId);
  return <div className="toolbar" key={p.id} style={{justifyContent:"space-between",borderBottom:"1px solid #e2e8f0",padding:9}}>
  <span>{p.label} — {count} صوت</span><button className={already?"secondary":"primary"} disabled={busy||!workshop.vote_open}
  onClick={()=>void vote(p)}>{already?"سحب صوتي":"التصويت"}</button>
  </div>;
 })}
 <p className="muted">التصويت {workshop.vote_open?"مفتوح":"مغلق"} حاليًا</p>
 </section>}
 {showResults&&facilitator&&<section className="card worksheet-print-host">
 <h2>المخرجات النهائية للورشة</h2>
 <div className="toolbar no-print"><button className="primary" disabled={busy} onClick={()=>void excel()}>تصدير Excel</button>
 <button className="secondary" onClick={()=>window.print()}>حفظ PDF / طباعة النماذج</button></div>
 <WorksheetPrint workshop={workshop} answers={answers} groups={groups} participants={participants} organizationName={organizationName}/>
 <h3>النماذج المعتمدة</h3>
 {!reviews.some(r=>r.finalized_at)&&<p>لم يُعتمد نموذج كامل بعد.</p>}
 {reviews.filter(r=>r.finalized_at).map(r=><section key={r.stage}><h3>{STAGES[r.stage-1].name}</h3>
 {STAGES[r.stage-1].fields.map(f=><article key={f.key}><strong>{f.title}</strong>
 <p style={{whiteSpace:"pre-wrap"}}>{r.fields[f.key].content}</p>
 <small>{reviewSource(r.fields[f.key])}</small></article>)}</section>)}
 {decisions.length>0&&<h3>قرارات النموذج السابقة</h3>}
 {decisions.map(d=><article key={d.stage}><strong>{STAGES[d.stage-1].name}</strong><p style={{whiteSpace:"pre-wrap"}}>{d.content}</p><small>اعتمد بواسطة {participants.find(p=>p.user_id===d.decided_by)?.display_name||"ميسّر الورشة"}</small></article>)}
 <h3>المقترحات المتكررة</h3>
 <p className="muted">احتفظنا بكل نص أصلي؛ المقترحات المجمعة أدناه للمراجعة فقط.</p>
 {!grouped.length&&<p>لا توجد إجابات مدخلة حتى الآن.</p>}
 {grouped.map((g,i)=><article key={i} style={{borderBottom:"1px solid #e2e8f0",padding:9}}>
 <strong>{STAGES[g.stage-1]?.name} — {fieldName(g.stage,g.field_key)}</strong>
 <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{g.text}</p><small>ورد {g.who.length} مرة: {g.who.join("، ")}</small>
 </article>)}
 <h3>جميع الإجابات الأصلية</h3>
 {answers.map(a=><article key={a.id} style={{borderBottom:"1px solid #e2e8f0",padding:9}}>
 <strong>{STAGES[a.stage-1]?.name} — {fieldName(a.stage,a.field_key)} — {source(a)}</strong>
 <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{a.content}</p></article>)}
 <h3>التصويت</h3>
 {[...priorities].sort((a,b)=>votes.filter(v=>v.priority_id===b.id).length-votes.filter(v=>v.priority_id===a.id).length)
  .map(p=><p key={p.id}>{p.label} — {votes.filter(v=>v.priority_id===p.id).length} صوت</p>)}
 </section>}
 </main>;
}
