import type {ReactNode} from "react";
import {executionRows,performanceRows,impactForGroup,followupForGroup,worksheetDataNote} from "@/lib/worksheet-details";
import type {Answer,Group,Participant,Workshop} from "@/lib/types";
import {
  worksheetGroups,worksheetLines,worksheetPairs,worksheetValue,type WorksheetGroup
} from "@/lib/worksheet-model";

type Props={workshop:Workshop;answers:Answer[];groups:Group[];participants:Participant[];organizationName?:string};
function fill<T>(items:T[],count:number,empty:T):T[]{
  return Array.from({length:Math.max(items.length,count)},(_,i)=>items[i]??empty);
}
function PageHeader({g,number,title,subtitle}:{
  g:WorksheetGroup;number:number;title:string;subtitle:string
}){
 return <><header className="bosla-ws-header">
  <div className="bosla-ws-brand"><strong>ورشة التخطيط التشاركي {g.planningYear}</strong>
   <small>{g.workshopTitle}</small></div>
  <div className="bosla-ws-hero"><strong>{title}</strong></div>
  <div className="bosla-ws-number">▤ ورقة عمل ({number})</div>
 </header>
 <h3 className="bosla-ws-subtitle">{subtitle}</h3>
 <div className="bosla-ws-members"><strong>رقم المجموعة: {g.number}</strong><span>أعضاء المجموعة:
  {fill(g.members,3,"................................").slice(0,Math.max(3,g.members.length)).map((p,i)=>
   <span key={i}>{i+1}. {p}</span>)}</span></div></>;
}
function Block({title,color="blue",children}:{
 title:string;color?:string;children:ReactNode
}){return <section className={"bosla-ws-box bosla-ws-"+color}>
 <h4>{title}</h4><div className="bosla-ws-inner">{children}</div></section>;}
function Lines({values,count=5,checks=false}:{
 values:string[];count?:number;checks?:boolean
}){
 return <div className="bosla-ws-lines">{fill(values,count,"").map((v,i)=>
  <div className="bosla-ws-line" key={i}>{checks&&<span className="bosla-ws-check">□</span>}
   <span>{v||"................................................................"}</span></div>)}</div>;
}
function GridTable({columns,rows,min=4}:{
 columns:string[];rows:string[][];min?:number
}){
 const empty=columns.map(()=>"");
 return <table className="bosla-ws-table"><thead><tr>{columns.map((c,i)=><th key={i}>{c}</th>)}</tr></thead>
 <tbody>{fill(rows,min,empty).map((row,i)=><tr key={i}>{columns.map((_,j)=><td key={j}>{row[j]??""}</td>)}</tr>)}</tbody></table>;
}
function Reality({g}: {g:WorksheetGroup}){
 const teams=worksheetPairs(g,1,"teams",4);
 const counts=teams.map(p=>p[1]).filter(Boolean).map(Number);
 const total=counts.length&&counts.every(Number.isFinite)?String(counts.reduce((a,b)=>a+b,0)):"";
 const scope=worksheetLines(g,1,"scope",4),locations=worksheetLines(g,1,"locations",4);
 const note=[worksheetValue(g,1,"resources")&&"الموارد: "+worksheetValue(g,1,"resources"),
  worksheetValue(g,1,"challenges")&&"التحديات: "+worksheetValue(g,1,"challenges")].filter(Boolean).join(" — ");
 return <article className="bosla-ws-page">
  <PageHeader g={g} number={1} title="أين نحن الآن؟" subtitle="تشخيص الواقع الحالي للهيئة"/>
  <div className="bosla-ws-grid bosla-ws-grid-three">
   <Block title="1. الموارد البشرية الحالية"><GridTable columns={["الفريق / الجهة","عدد الأفراد"]} rows={[...teams.map(p=>[p[0],p[1]]),["الإجمالي",total]]} min={5}/></Block>
   <Block title="2. نطاق العمل والمواقع"><GridTable columns={["النطاق / المنطقة","أهم المواقع / أماكن العمل"]}
    rows={fill(scope,Math.max(scope.length,locations.length,4),"").map((v,i)=>[v,locations[i]??""])}/></Block>
   <Block title="3. الفئات المستهدفة" color="purple"><Lines checks values={worksheetLines(g,1,"target_groups")}/></Block>
   <Block title="4. اللجان والمهام المركزية"><Lines checks values={[]}/></Block>
   <Block title="5. الخدمات والأنشطة الحالية" color="gold"><Lines checks values={worksheetLines(g,1,"services")}/></Block>
   <Block title="أبرز الإنجازات الحالية" color="green"><Lines values={worksheetLines(g,1,"achievements")}/></Block>
  </div>
  <div className="bosla-ws-summary"><strong>خلاصة المجموعة:</strong><span>{note||"ملاحظات عامة عن واقع الهيئة الحالي"}</span></div>
 </article>;
}
function Swot({g}:{g:WorksheetGroup}){
 const issues=worksheetLines(g,2,"priorities",3);
 return <article className="bosla-ws-page">
  <PageHeader g={g} number={2} title="ما الذي يساعدنا وما الذي يعيقنا؟" subtitle="تحليل البيئة الداخلية والخارجية (SWOT)"/>
  <div className="bosla-ws-grid bosla-ws-grid-two">
   <Block title="نقاط القوة (S)" color="green"><p className="bosla-ws-help">ما الذي تتميز به الهيئة داخليًا؟</p><Lines checks values={worksheetLines(g,2,"strengths")}/></Block>
   <Block title="نقاط الضعف (W)" color="red"><p className="bosla-ws-help">ما الذي يحتاج إلى تحسين داخل الهيئة؟</p><Lines checks values={worksheetLines(g,2,"weaknesses")}/></Block>
   <Block title="الفرص (O)" color="blue"><p className="bosla-ws-help">ما الفرص الخارجية التي يمكن الاستفادة منها؟</p><Lines checks values={worksheetLines(g,2,"opportunities")}/></Block>
   <Block title="التهديدات (T)" color="gold"><p className="bosla-ws-help">ما المخاطر الخارجية التي قد تعيق عملنا؟</p><Lines checks values={worksheetLines(g,2,"threats")}/></Block>
  </div>
  <div className="bosla-ws-summary"><strong>أهم القضايا الاستراتيجية المستخلصة:</strong>
   <span>{fill(issues,3,"................................").map((v,i)=><span key={i}>{i+1}. {v}　</span>)}</span>
  </div>
 </article>;
}
function Goals({g}:{g:WorksheetGroup}){
 const goals=worksheetLines(g,3,"goals",5);
 const priorities=worksheetLines(g,3,"goal_priorities",5);
 const results=worksheetLines(g,3,"expected_results",4);
 const indicators=worksheetLines(g,5,"kpis",4);
 const ordered=fill(goals,3,"").slice(0,3);
 return <article className="bosla-ws-page">
  <PageHeader g={g} number={3} title={"ماذا نريد أن نحقق في عام "+g.planningYear+"؟"} subtitle="تحديد الأهداف والأولويات"/>
  <div className="bosla-ws-goals-grid">
   <Block title={"أهدافنا لعام "+g.planningYear}>
    <GridTable min={5} columns={["رقم","الهدف المقترح (ماذا نريد أن نحقق؟)","الأولوية"]}
     rows={fill(goals,5,"").map((value,i)=>[String(i+1),value,priorities[i]??""])}/></Block>
   <Block title="معايير اختيار الأهداف" color="purple">
    <p className="bosla-ws-help">اختر أهم 3–5 أهداف وفق المعايير التالية:</p>
    <Lines count={5} checks values={["مهم ويخدم رسالة الهيئة","يخدم أكبر عدد من المستفيدين",
    "واقعي وقابل للتنفيذ","يتناسب مع الموارد المتاحة","له أثر واضح وقابل للقياس"]}/></Block>
  </div>
  <div className="bosla-ws-grid bosla-ws-grid-two bosla-ws-goals-bottom">
   <Block title="مؤشرات النجاح العامة" color="green"><Lines count={4} values={indicators}/></Block>
   <Block title="النتيجة المتوقعة" color="gold"><Lines count={4} values={results}/></Block>
  </div>
  <div className="bosla-ws-summary"><strong>الأهداف الأكثر أولوية (خلاصة المجموعة):</strong>
   <span>{ordered.map((v,i)=><span key={i}>{i+1}. {v||".............................."}　</span>)}</span></div>
 </article>;
}

function DetailPanels({items}:{items:{title:string;values:string[];color:string}[]}){
  return <div className="bosla-ws-grid bosla-ws-grid-three bosla-ws-detail-panels">
    {items.map(item=><Block key={item.title} title={item.title} color={item.color}>
      <Lines count={5} values={item.values} checks/>
    </Block>)}
  </div>;
}
function Execution({g}:{g:WorksheetGroup}){
  const rows=executionRows(g);
  return <article className="bosla-ws-page bosla-ws-detail-page">
    <PageHeader g={g} number={4} title="كيف سنحقق أهدافنا؟"
      subtitle="تحديد البرامج والمشاريع والأنشطة لتنفيذ الأهداف"/>
    <h3 className="bosla-ws-detail-caption">الخطة التنفيذية المقترحة لعام {g.planningYear}</h3>
    <GridTable min={5} columns={["رقم","المشروع / النشاط","الهدف المرتبط (من ورقة 3)",
      "الفئة المستهدفة","الكمية المستهدفة","فترة التنفيذ","المسؤول","التكلفة التقديرية"]}
      rows={rows.map(r=>[String(r.number),r.activity,r.goal,r.audience,
        r.quantity,r.period,r.manager,r.cost])}/>
    <DetailPanels items={[
      {title:"متطلبات النجاح",values:[],color:"purple"},
      {title:"المخاطر المحتملة",values:[],color:"gold"},
      {title:"مؤشرات التنفيذ والمتابعة",values:[],color:"green"}
    ]}/>
    <div className="bosla-ws-summary"><strong>أهم 3 أنشطة ذات أولوية (توصية المجموعة):</strong>
      <span>1. ........................　 2. ........................　 3. ........................</span>
    </div>
    <p className="bosla-ws-detail-note">{worksheetDataNote}</p>
  </article>;
}
function Performance({g}:{g:WorksheetGroup}){
  const rows=performanceRows(g);
  return <article className="bosla-ws-page bosla-ws-detail-page">
    <PageHeader g={g} number={5} title="كيف نعرف أننا نجحنا؟"
      subtitle="تحديد مؤشرات الأداء وقياس النتائج"/>
    <h3 className="bosla-ws-detail-caption">مؤشرات النجاح لأهدافنا لعام {g.planningYear}</h3>
    <GridTable min={5} columns={["رقم","الهدف (من ورقة 3)","مؤشر الأداء (كيف نقيس النجاح؟)",
      "خط الأساس (الوضع الحالي)","المستهدف "+g.planningYear,"مصدر التحقق","دورية القياس"]}
      rows={rows.map(r=>[String(r.number),r.goal,r.kpi,r.baseline,
        r.target,r.verification,r.frequency])}/>
    <DetailPanels items={[
      {title:"آلية المتابعة والتقييم",values:followupForGroup(g),color:"purple"},
      {title:"معايير الحكم على النجاح",values:[],color:"gold"},
      {title:"النتائج المتوقعة والأثر",values:impactForGroup(g),color:"green"}
    ]}/>
    <div className="bosla-ws-summary"><strong>أهم 3 مؤشرات رئيسية للمتابعة المؤسسية:</strong>
      <span>1. ........................　 2. ........................　 3. ........................</span>
    </div>
    <p className="bosla-ws-detail-note">{worksheetDataNote}</p>
  </article>;
}

export default function WorksheetPrint({workshop,answers,groups,participants,organizationName}:Props){
 return <div className="bosla-worksheet-print" aria-label="أوراق العمل الجاهزة للطباعة">
  {worksheetGroups(workshop,answers,groups,participants,organizationName).map(g=><div key={g.id}>
   <Reality g={g}/><Swot g={g}/><Goals g={g}/><Execution g={g}/><Performance g={g}/>
  </div>)}
 </div>;
}
