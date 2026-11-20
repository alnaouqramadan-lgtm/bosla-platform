import {reviewSource,type FormReview} from "@/lib/form-review";
import type {Answer, Group,Participant,Priority,Vote,Workshop} from "@/lib/types";
import {STAGES,fieldName,normalizeLine} from "@/lib/stages";
import {worksheetGroups,worksheetLines,worksheetPairs,worksheetValue} from "@/lib/worksheet-model";

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
 decisions:{stage:number;content:string;decided_by:string}[]=[],reviews:FormReview[]=[],organizationName=""
){
 const {default: ExcelJS}=await import("exceljs");
 const book=new ExcelJS.Workbook();book.creator="BOSLA AI";

 // Styled, editable worksheet facsimiles appear before the audit/data sheets.
 // The designs are a layout layer; all original answers remain intact below.
 for(const g of worksheetGroups(workshop,answers,groups,participants,organizationName)){
  const navy="FF073668",blue="FF095D91",pale="FFE7F2FC",green="FFE4F4E9";
  const violet="FFF2E9FB",gold="FFFFF2D5",red="FFF9E6EB";
  const border={style:"thin" as const,color:{argb:"FFB4C5D8"}};
  const commonBorder={top:border,bottom:border,left:border,right:border};
  const make=(number:number,label:string)=>{
   const tab=book.addWorksheet("ورقة "+number+" - مجموعة "+g.number,{
    views:[{rightToLeft:true,showGridLines:false}],
    pageSetup:{paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:1,
     margins:{left:0.2,right:0.2,top:0.25,bottom:0.25,header:0,footer:0}}
   });
   for(let i=1;i<=12;i++)tab.getColumn(i).width=13.5;
   for(let i=1;i<=29;i++)tab.getRow(i).height=26;
   const put=(range:string,value:string|number,fill:string="FFFFFFFF",font="FF0C2D55",bold=false,size=11)=>{
    if(range.includes(":")&&range.split(":")[0]!==range.split(":")[1])tab.mergeCells(range);
    const cell=tab.getCell(range.split(":")[0]);cell.value=safe(value);
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:fill}};
    cell.font={name:"Arial",size,bold,color:{argb:font}};
    cell.alignment={horizontal:"center",vertical:"middle",wrapText:true,readingOrder:"rtl"};
    cell.border=commonBorder;
   };
   const data=(range:string,value:string|number,fill="FFFFFFFF")=>{
    put(range,value,fill,"FF1F2B3B",false,10);
    tab.getCell(range.split(":")[0]).alignment={horizontal:"right",vertical:"middle",wrapText:true,readingOrder:"rtl"};
   };
   put("A1:D2","ورشة التخطيط التشاركي "+g.planningYear+"\n"+g.workshopTitle,pale,navy,true,13);
   put("E1:J2",label,blue,"FFFFFFFF",true,18);
   put("K1:L2","ورقة عمل ("+number+")",navy,"FFFFFFFF",true,14);
   put("A3:L3",number===1?"تشخيص الواقع الحالي للهيئة":
    number===2?"تحليل البيئة الداخلية والخارجية (SWOT)":"تحديد الأهداف والأولويات",pale,navy,true,13);
   put("A4:D4","رقم المجموعة: "+g.number,pale,navy,true);
   put("E4:L4","أعضاء المجموعة: "+(g.members.join(" ، ")||"................................................"),"FFFFFFFF",navy);
   tab.getRow(1).height=29;tab.getRow(2).height=27;tab.getRow(3).height=28;
   tab.getRow(4).height=30;
   const heading=(range:string,title:string,fill=pale)=>put(range,title,fill,navy,true,12);
   const notes=(row:number,text:string,fill=violet)=>data("A"+row+":L"+row,text,fill);
   tab.headerFooter.oddFooter="بوصلة AI | BOSLA AI";
   return {tab,put,data,heading,notes,pale,green,gold,violet,red};
  };
  // Worksheet 1: current-state diagnosis.
  {
   const s=make(1,"أين نحن الآن؟");
   s.heading("A6:D6","1. الموارد البشرية الحالية");
   s.heading("E6:H6","2. نطاق العمل والمواقع");
   s.heading("I6:L6","3. الفئات المستهدفة",s.violet);
   s.heading("A7:B7","الفريق / الجهة");s.heading("C7:D7","عدد الأفراد");
   s.heading("E7:F7","النطاق / المنطقة");s.heading("G7:H7","أهم المواقع / أماكن العمل");
   const teams=worksheetPairs(g,1,"teams",5),scopes=worksheetLines(g,1,"scope",5);
   const places=worksheetLines(g,1,"locations",5),targets=worksheetLines(g,1,"target_groups",5);
   for(let i=0;i<5;i++){
    const r=i+8;
    s.data("A"+r+":B"+r,teams[i]?.[0]??"");
    s.data("C"+r+":D"+r,teams[i]?.[1]??"");
    s.data("E"+r+":F"+r,scopes[i]??"");
    s.data("G"+r+":H"+r,places[i]??"");
    s.data("I"+r+":L"+r,targets[i]??"");
   }
   s.heading("A14:D14","4. اللجان والمهام المركزية");
   s.heading("E14:H14","5. الخدمات والأنشطة الحالية",s.gold);
   s.heading("I14:L14","أبرز الإنجازات الحالية",s.green);
   const services=worksheetLines(g,1,"services",5),achievements=worksheetLines(g,1,"achievements",5);
   for(let i=0;i<5;i++){
    const r=i+15;
    s.data("A"+r+":D"+r,""); // No equivalent recorded field; leave editable.
    s.data("E"+r+":H"+r,services[i]??"");
    s.data("I"+r+":L"+r,achievements[i]??"");
   }
   const extra=["الموارد: "+worksheetValue(g,1,"resources"),"التحديات: "+worksheetValue(g,1,"challenges")]
    .filter(v=>!v.endsWith(": ")).join(" | ");
   s.heading("A21:L21","خلاصة المجموعة",s.violet);
   s.notes(22,extra);
   s.tab.getRow(22).height=48;
  }
  // Worksheet 2: SWOT (four equal quadrants) and top issues.
  {
   const s=make(2,"ما الذي يساعدنا وما الذي يعيقنا؟");
   const blocks=[
    {name:"نقاط القوة (S)",field:"strengths",col:"A",end:"F",fill:s.green,head:6},
    {name:"نقاط الضعف (W)",field:"weaknesses",col:"G",end:"L",fill:s.red,head:6},
    {name:"الفرص (O)",field:"opportunities",col:"A",end:"F",fill:s.pale,head:14},
    {name:"التهديدات (T)",field:"threats",col:"G",end:"L",fill:s.gold,head:14}
   ];
   for(const block of blocks){
    s.heading(block.col+block.head+":"+block.end+block.head,block.name,block.fill);
    const lines=worksheetLines(g,2,block.field,5);
    for(let i=0;i<5;i++)s.data(block.col+(block.head+i+1)+":"+block.end+(block.head+i+1),
      (i+1)+". "+(lines[i]??""));
   }
   const issues=worksheetLines(g,2,"priorities",3);
   s.heading("A22:L22","أهم القضايا الاستراتيجية المستخلصة",s.violet);
   for(let i=0;i<3;i++)s.notes(i+23,(i+1)+". "+(issues[i]??""));
  }
  // Worksheet 3: five goals, priorities, expected results and KPIs.
  {
   const s=make(3,"ماذا نريد أن نحقق في عام "+g.planningYear+"؟");
   s.heading("A6:I6","أهدافنا لعام "+g.planningYear);
   s.heading("J6:L6","معايير اختيار الأهداف",s.violet);
   s.heading("A7:A7","رقم");s.heading("B7:G7","الهدف المقترح");s.heading("H7:I7","الأولوية");
   const goals=worksheetLines(g,3,"goals",5),ranks=worksheetLines(g,3,"goal_priorities",5);
   const criteria=["مهم ويخدم رسالة الهيئة","يخدم أكبر عدد من المستفيدين",
    "واقعي وقابل للتنفيذ","يتناسب مع الموارد المتاحة","له أثر واضح وقابل للقياس"];
   for(let i=0;i<5;i++){
    const r=i+8;s.data("A"+r+":A"+r,i+1);
    s.data("B"+r+":G"+r,goals[i]??"");s.data("H"+r+":I"+r,ranks[i]??"");
    s.data("J"+r+":L"+r,"□ "+criteria[i]);s.tab.getRow(r).height=39;
   }
   s.heading("A15:F15","مؤشرات النجاح العامة",s.green);
   s.heading("G15:L15","النتيجة المتوقعة",s.gold);
   const kpis=worksheetLines(g,5,"kpis",4),results=worksheetLines(g,3,"expected_results",4);
   for(let i=0;i<4;i++){
    const r=i+16;s.data("A"+r+":F"+r,kpis[i]??"");
    s.data("G"+r+":L"+r,results[i]??"");
   }
   s.heading("A21:L21","الأهداف الأكثر أولوية (خلاصة المجموعة)",s.violet);
   for(let i=0;i<3;i++)s.notes(i+22,(i+1)+". "+(goals[i]??""));
  }
 }

 const sources=(a:Answer)=>a.scope==="group"?groups.find(g=>g.id===a.owner_id)?.name||"—":
  participants.find(p=>p.user_id===a.owner_id)?.display_name||"—";
 const total=STAGES.reduce((sum,stage)=>sum+stage.fields.length,0);
 const sheets:{name:string;headings:string[];rows:(string|number)[][]}[]=[
  {name:"الورشة",headings:["البيان","القيمة"],rows:[["عنوان الورشة",workshop.title],["سنة التخطيط",workshop.planning_year],
   ["تاريخ الورشة",workshop.workshop_date],["عدد المجموعات",groups.length],["عدد المشاركين",participants.length]]},
  {name:"النماذج المعتمدة",headings:["النموذج","الخانة","الصياغة المعتمدة","مصدر الصياغة","النص عند التبنّي","اعتمد النموذج","تاريخ الاعتماد"],rows:reviews.filter(r=>r.finalized_at).flatMap(r=>STAGES[r.stage-1].fields.map(f=>{const v=r.fields[f.key];return [STAGES[r.stage-1].name,f.title,v.content,reviewSource(v),v.source_text??"",participants.find(p=>p.user_id===r.finalized_by)?.display_name??r.finalized_by??"",r.finalized_at??""]}))},
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
 link.href=url;link.download=`BOSLA-Worksheets-${workshop.planning_year}.xlsx`;
 document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
