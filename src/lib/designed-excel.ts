import type {Workbook,Worksheet} from "exceljs";
import type {Workshop} from "./types";
import type {FormReview} from "./form-review";
import {STAGES} from "./stages";
import {approvedValue,worksheetData} from "./worksheet-model";

const C={navy:"FF082A62",blue:"FF0D559A",pale:"FFD9EAFB",ink:"FF12264A",
  border:"FFB4C5D9",white:"FFFFFFFF",alt:"FFF6FAFF",
  green:"FFDDF5E0",greenInk:"FF125E2B",yellow:"FFFFF0C9",
  purple:"FFEDE1F8",purpleInk:"FF63218A"};
function literal(v:unknown):string|number {
  if(typeof v==="number" && Number.isFinite(v))return v;
  const s=String(v??"").slice(0,32760);
  return /^\s*[=+\-@]/.test(s)?"'"+s:s;
}
function fill(tab:Worksheet,row:number,from:number,to:number,color:string) {
  for(let col=from;col<=to;col++)tab.getRow(row).getCell(col).fill={
    type:"pattern",pattern:"solid",fgColor:{argb:color}
  };
}
function merged(tab:Worksheet,row:number,start:number,end:number,text:string,
  bg:string,ink:string,size=12) {
  fill(tab,row,start,end,bg);
  tab.mergeCells(row,start,row,end);
  const cell=tab.getRow(row).getCell(start);
  cell.value=literal(text);
  cell.font={name:"Arial",size,bold:true,color:{argb:ink}};
  cell.alignment={horizontal:"center",vertical:"middle",wrapText:true};
}
function base(book:Workbook,name:string,workshop:Workshop,title:string,sub:string,
  columnWidths:number[]):Worksheet {
  const tab=book.addWorksheet(name,{views:[{state:"frozen",ySplit:7,rightToLeft:true}]});
  tab.pageSetup={paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0};
  tab.pageMargins={left:.24,right:.24,top:.35,bottom:.35,header:.12,footer:.12};
  tab.properties.defaultRowHeight=26;
  columnWidths.forEach((width,i)=>tab.getColumn(i+1).width=width);
  const last=columnWidths.length;
  merged(tab,1,1,last,workshop.title+"  |  ورشة التخطيط التشاركي "+workshop.planning_year,C.navy,C.white,16);
  tab.getRow(1).height=37;
  merged(tab,2,1,last,title,C.blue,C.white,20);
  tab.getRow(2).height=45;
  merged(tab,3,1,last,sub,C.pale,C.navy,12);
  tab.getRow(3).height=30;
  merged(tab,4,1,last,"المؤسسة: "+workshop.title+"    |    السنة: "+workshop.planning_year+
    "    |    تاريخ الورشة: "+workshop.workshop_date,C.white,C.navy,11);
  tab.getRow(4).height=28;
  merged(tab,5,1,last,"رقم المجموعة: ____________       أعضاء المجموعة: 1. ____________   2. ____________   3. ____________",C.white,C.ink,11);
  tab.getRow(5).height=28;
  tab.headerFooter.oddFooter="&CBOSLA AI — "+name+" &Rصفحة &P من &N";
  return tab;
}
function headers(tab:Worksheet,columns:string[],row=7) {
  columns.forEach((h,i)=>{
    const cell=tab.getRow(row).getCell(i+1);
    cell.value=h;cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:C.pale}};
    cell.font={name:"Arial",size:11,bold:true,color:{argb:C.navy}};
    cell.alignment={horizontal:"center",vertical:"middle",wrapText:true};
    cell.border={top:{style:"thin",color:{argb:C.border}},
      bottom:{style:"thin",color:{argb:C.border}},
      left:{style:"thin",color:{argb:C.border}},
      right:{style:"thin",color:{argb:C.border}}};
  });
  tab.getRow(row).height=48;
}
function dataRow(tab:Worksheet,rowNum:number,values:(string|number)[]) {
  values.forEach((value,index)=>{
    const cell=tab.getRow(rowNum).getCell(index+1);
    cell.value=literal(value);
    cell.font={name:"Arial",size:10,color:{argb:C.ink}};
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:rowNum%2?C.white:C.alt}};
    cell.alignment={horizontal:"right",vertical:"middle",wrapText:true};
    cell.border={bottom:{style:"hair",color:{argb:C.border}},
      left:{style:"hair",color:{argb:C.border}},
      right:{style:"hair",color:{argb:C.border}}};
  });
  tab.getRow(rowNum).height=48;
}
function panels(tab:Worksheet,fromRow:number,count:number,
  sections:{title:string;content:string;color:string}[],note:string) {
  const splits=count===8?[[1,3],[4,6],[7,8]]:[[1,2],[3,4],[5,7]];
  sections.forEach((s,i)=>{
    const [a,b]=splits[i];
    merged(tab,fromRow,a,b,s.title,s.color,C.navy,12);
    merged(tab,fromRow+1,a,b,s.content||"____________________________________________________",C.white,C.ink,10);
  });
  tab.getRow(fromRow).height=35;
  tab.getRow(fromRow+1).height=72;
  merged(tab,fromRow+3,1,count,"أهم 3 أولويات / مؤشرات:  1. _____________________     2. _____________________     3. _____________________",C.purple,C.purpleInk,12);
  tab.getRow(fromRow+3).height=38;
  merged(tab,fromRow+5,1,count,note,C.yellow,C.ink,10);
  tab.getRow(fromRow+5).height=38;
  tab.pageSetup.printArea="A1:"+String.fromCharCode(64+count)+(fromRow+5);
}
function general(book:Workbook,workshop:Workshop,reviews:FormReview[],stage:number) {
  const def=STAGES[stage-1];
  const tab=base(book,"نموذج "+stage,workshop,def.name,def.description,[25,90]);
  merged(tab,6,1,2,"مخرجات ورقة العمل ("+stage+")",C.pale,C.navy,14);
  headers(tab,["المحور / السؤال","الإجابة المعتمدة"]);
  def.fields.forEach((field,i)=>dataRow(tab,i+8,[field.title,approvedValue(reviews,stage,field.key)]));
  const last=8+def.fields.length;
  merged(tab,last,1,2,"المصدر: الصياغات التي اعتمدها ميسّر الورشة. لا تُصدّر الإجابات غير المعتمدة كنقاط نهائية.",C.yellow,C.ink,10);
  tab.getRow(last).height=35;
  tab.pageSetup.printArea="A1:B"+last;
}
export function appendDesignedWorksheets(book:Workbook,workshop:Workshop,reviews:FormReview[]) {
  const data=worksheetData(reviews);
  for(let i=1;i<=3;i++)general(book,workshop,reviews,i);
  const tab4=base(book,"نموذج 4",workshop,"كيف سنحقق أهدافنا؟",
    "تحديد البرامج والمشاريع والأنشطة لتنفيذ الأهداف — الخطة التنفيذية المقترحة لعام "+workshop.planning_year,
    [8,34,27,21,18,19,22,20]);
  merged(tab4,6,1,8,"الخطة التنفيذية المقترحة لعام "+workshop.planning_year,C.pale,C.navy,15);
  headers(tab4,["رقم","المشروع / النشاط","الهدف المرتبط (من ورقة 3)","الفئة المستهدفة",
    "الكمية المستهدفة","فترة التنفيذ","المسؤول","التكلفة التقديرية"]);
  data.activities.forEach((r,i)=>dataRow(tab4,i+8,[r.number,r.project,r.goal,r.audience,
    r.quantity,r.period,r.responsible,r.estimatedCost]));
  panels(tab4,8+data.activities.length+2,8,[
    {title:"متطلبات النجاح",content:data.implementationNeeds,color:C.purple},
    {title:"المخاطر المحتملة",content:data.risks,color:C.yellow},
    {title:"مؤشرات التنفيذ والمتابعة",content:data.implementationMonitoring,color:C.green}
  ],data.dataNote);
  const tab5=base(book,"نموذج 5",workshop,"كيف نعرف أننا نجحنا؟",
    "تحديد مؤشرات الأداء وقياس النتائج — مؤشرات النجاح لأهداف عام "+workshop.planning_year,
    [8,27,39,22,22,27,21]);
  merged(tab5,6,1,7,"مؤشرات النجاح لأهدافنا لعام "+workshop.planning_year,C.pale,C.navy,15);
  headers(tab5,["رقم","الهدف (من ورقة 3)","مؤشر الأداء (كيف نقيس النجاح؟)",
    "خط الأساس (الوضع الحالي)","المستهدف "+workshop.planning_year,
    "مصدر التحقق","دورية القياس"]);
  data.indicators.forEach((r,i)=>dataRow(tab5,i+8,[r.number,r.goal,r.indicator,r.baseline,
    r.target,r.verification,r.frequency]));
  panels(tab5,8+data.indicators.length+2,7,[
    {title:"النتائج المتوقعة والأثر",content:data.expectedResults,color:C.green},
    {title:"معايير الحكم على النجاح",content:data.successCriteria,color:C.yellow},
    {title:"آلية المتابعة والتقييم",content:data.evaluation,color:C.purple}
  ],data.dataNote);
  const goals=book.addWorksheet("أهداف ورقة 3",{views:[{state:"frozen",ySplit:1,rightToLeft:true}]});
  goals.getColumn(1).width=74;goals.getColumn(2).width=30;
  headers(goals,["الأهداف المعتمدة من ورقة العمل (3)","الحالة"],1);
  data.goals.forEach((goal,i)=>dataRow(goals,i+2,[goal,"معتمد"]));
  if(data.goals.length){
    book.definedNames.add("'أهداف ورقة 3'!$A$2:$A$"+(data.goals.length+1),"BoslaGoals");
    for(const tab of [tab4,tab5]){
      const rows=tab===tab4?data.activities.length:data.indicators.length;
      const column=tab===tab4?3:2;
      for(let i=8;i<8+rows;i++){
        const c=tab.getRow(i).getCell(column);
        c.dataValidation={type:"list",allowBlank:true,formulae:["BoslaGoals"],
          showErrorMessage:true,errorTitle:"اختيار الهدف",error:"اختر هدفًا معتمدًا من ورقة (3)."};
      }
    }
  }
}
