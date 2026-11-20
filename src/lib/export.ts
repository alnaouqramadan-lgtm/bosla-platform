import type {FormReview} from "@/lib/form-review";
import type {Answer, Group,Participant,Priority,Vote,Workshop} from "@/lib/types";
import {STAGES,fieldName,normalizeLine} from "@/lib/stages";

export type GroupedLine={stage:number;field_key:string;text:string;who:string[]};
export function groupRepeated(answers:Answer[], groups:Group[], participants:Participant[]):GroupedLine[]{
 const grouped = new Map<string,GroupedLine>();
 const owner=(a:Answer)=>a.scope==="group"?groups.find(g=>g.id===a.owner_id)?.name||a.owner_id:
  participants.find(p=>p.user_id===a.owner_id)?.display_name||a.owner_id;
 for(const answer of answers){for(const line of answer.content.split(/\r?\n/)){
  const text=line.trim();if(!text)continue;
  const key=[answer.stage,answer.field_key,normalizeLine(text)].join(":");
  const current=grouped.get(key)||{stage:answer.stage,field_key:answer.field_key,text,who:[]};
  current.who.push(owner(answer));grouped.set(key,current);
 }}
 return [...grouped.values()].sort((a,b)=>b.who.length-a.who.length);
}

function safe(value:string|number|undefined|null):string|number{
 if(typeof value==="number"&&Number.isFinite(value))return value;
 const text=String(value??"").slice(0,32760);
 // Forces any user-entered content to remain literal in Excel.
 return /^[\s]*[=+\-@]/.test(text)?"'"+text:text;
}
export async function exportWorkbook(
 workshop:Workshop,answers:Answer[],groups:Group[],participants:Participant[],priorities:Priority[],votes:Vote[],
 decisions:{stage:number;content:string;decided_by:string}[]=[],reviews:FormReview[]=[]
){
 const {default: ExcelJS}=await import("exceljs");
 const book=new ExcelJS.Workbook();book.creator="BOSLA AI";
 const sources=(a:Answer)=>a.scope==="group"?groups.find(g=>g.id===a.owner_id)?.name||"—":
  participants.find(p=>p.user_id===a.owner_id)?.display_name||"—";
 const total=STAGES.reduce((sum,stage)=>sum+stage.fields.length,0);
 const sheets:{name:string;headings:string[];rows:(string|number)[][]}[]=[
  {name:"الورشة",headings:["البيان","القيمة"],rows:[["عنوان الورشة",workshop.title],["سنة التخطيط",workshop.planning_year],
   ["تاريخ الورشة",workshop.workshop_date],["عدد المجموعات",groups.length],["عدد المشاركين",participants.length]]},
  {name:"النماذج المعتمدة",headings:["النموذج","الخانة","الصياغة المعتمدة","المجموعة المصدر","النص عند التبنّي","اعتمد النموذج","تاريخ الاعتماد"],rows:reviews.filter(r=>r.finalized_at).flatMap(r=>STAGES[r.stage-1].fields.map(f=>{const v=r.fields[f.key];return [STAGES[r.stage-1].name,f.title,v.content,v.group_name??"صياغة الميسّر",v.source_text??"",participants.find(p=>p.user_id===r.finalized_by)?.display_name??r.finalized_by??"",r.finalized_at??""]}))},
  {name:"القرارات المعتمدة",headings:["النموذج","القرار","اعتمد بواسطة"],rows:decisions.map(d=>[STAGES[d.stage-1].name,d.content,participants.find(p=>p.user_id===d.decided_by)?.display_name||d.decided_by])},
  {name:"الإجابات الأصلية",headings:["المرحلة","السؤال","المصدر","نوع الإدخال","الإجابة بالنص الأصلي","التحديث"],rows:answers.map(a=>[
   STAGES[a.stage-1]?.name||"—",fieldName(a.stage,a.field_key),sources(a),a.scope==="group"?"جماعي":"فردي",a.content,a.updated_at
  ])},
  {name:"المقترحات المجمعة",headings:["المرحلة","السؤال","النص","عدد التكرارات","المصادر"],
   rows:groupRepeated(answers,groups,participants).map(g=>[
    STAGES[g.stage-1]?.name||"—",fieldName(g.stage,g.field_key),g.text,g.who.length,g.who.join("، ")
   ])},
  {name:"الأولويات والتصويت",headings:["القضية","عدد الأصوات"],rows:priorities.map(p=>[
   p.label,votes.filter(v=>v.priority_id===p.id).length
  ])},
  {name:"تقدم المجموعات",headings:["المجموعة","عدد المشاركين","عدد الحقول المكتملة","إجمالي الحقول","النسبة المئوية"],rows:groups.map(g=>{
   const done=answers.filter(a=>a.scope==="group"&&a.owner_id===g.id&&a.content.trim()).length;
   return [g.name,participants.filter(p=>p.group_id===g.id).length,done,total,Math.round(done/total*100)];
  })}
 ];
 for(const sheet of sheets){
  const tab=book.addWorksheet(sheet.name,{views:[{state:"frozen",ySplit:1,rightToLeft:true}]});
  tab.columns=sheet.headings.map((h,i)=>({header:h,key:`c${i}`,width:Math.max(20,Math.min(55,h.length+16))}));
  tab.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
  tab.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF12376B"}};
  tab.getRow(1).height=30;
  tab.getRow(1).alignment={horizontal:"right",vertical:"middle",wrapText:true};
  for(const source of sheet.rows){
   const row=tab.addRow(sheet.headings.map((_,i)=>safe(source[i])));
   row.alignment={horizontal:"right",vertical:"top",wrapText:true};
   row.height=Math.min(400,Math.max(25,17*Math.max(1,...source.map(x=>String(x).split(/\r?\n/)
    .reduce((sum,l)=>sum+Math.max(1,Math.ceil(l.length/55)),0)))));
  }
  tab.autoFilter={from:{row:1,column:1},to:{row:1,column:sheet.headings.length}};
 }
 const content=await book.xlsx.writeBuffer();const bytes=new Uint8Array(content);
 if(bytes.byteLength<1000)throw Error("ملف Excel الناتج غير مكتمل");
 const blob=new Blob([bytes as BlobPart],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
 const url=URL.createObjectURL(blob);const link=document.createElement("a");
 link.href=url;link.download=`Planning-Workshop-${workshop.planning_year}.xlsx`;
 document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
