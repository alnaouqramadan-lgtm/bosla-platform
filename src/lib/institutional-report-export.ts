import type {PeriodicReport} from "@/lib/institutional-report";

const FORMULA=/^\s*[=+\-@]/;
function safeCell(value:string|number|null|undefined){
 if(value==null)return "";
 if(typeof value==="number")return Number.isFinite(value)?value:"";
 const text=value.slice(0,32760);
 return FORMULA.test(text)?"'"+text:text;
}
export async function downloadPeriodReportXlsx(plan:{title:string;id:string;period_start:string;period_end:string},
 organizationName:string, report:PeriodicReport){
 const {default:ExcelJS}=await import("exceljs");
 const book=new ExcelJS.Workbook();
 book.creator="BOSLA AI";
 book.subject="تقرير متابعة خطة مؤسسية معتمد";
 book.title=plan.title+" — "+report.window.label;
 const navy="FF08366B",blue="FF096A9F",pale="FFE8F2FC",gray="FFF2F5F9";
 type Column={header:string;key:string;width:number};
 const add=(name:string,columns:Column[],rows:(string|number|null|undefined)[][])=>{
  const sheet=book.addWorksheet(name,{views:[{state:"frozen",ySplit:1,rightToLeft:true}]});
  sheet.columns=columns;
  sheet.getRow(1).height=31;
  sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"},size:12};
  sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:navy}};
  sheet.getRow(1).alignment={horizontal:"right",vertical:"middle",wrapText:true};
  rows.forEach((values,i)=>{
   const row=sheet.addRow(values.map(safeCell));
   row.alignment={horizontal:"right",vertical:"top",wrapText:true};
   row.height=Math.min(100,Math.max(25,22+Math.max(...values.map(v=>String(v??"").length),0)/55*12));
   if(i%2===1)row.fill={type:"pattern",pattern:"solid",fgColor:{argb:gray}};
   row.eachCell(cell=>{
    cell.border={bottom:{style:"hair",color:{argb:"FFD8E1EB"}}};
   });
  });
  sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:columns.length}};
  sheet.pageSetup={paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0};
  sheet.headerFooter.oddFooter="BOSLA AI • صفحة &P من &N";
  return sheet;
 };
 const cols=(headings:string[],widths:number[])=>headings.map((header,i)=>({header,key:"c"+i,width:widths[i]??25}));
 const s=report.totals;
 add("الملخص",cols(["البيان","القيمة"],[45,65]),[
  ["المؤسسة",organizationName],["الخطة",plan.title],
  ["فترة الخطة",plan.period_start+" — "+plan.period_end],
  ["نطاق التقرير",report.window.label],["بداية الفترة",report.window.start],
  ["نهاية الفترة المحددة",report.window.end],["آخر تاريخ فعلي مشمول",report.asOf],
  ["هل بدأت الفترة؟",report.hasStarted?"نعم":"لا"],
  ["إجمالي أنشطة الخطة",s.activities],["الأنشطة المكتملة حتى تاريخ القطع",s.completed],
  ["الأنشطة المتأخرة غير المكتملة",s.overdue],["الأنشطة المتعثرة",s.blocked],
  ["أنشطة مجدولة لاحقًا",s.scheduled],["الأنشطة دون تقرير ساري",s.unreported],
  ["أنشطة لها تحديثات حتى تاريخ القطع",s.withReports],
  ["تحديثات التنفيذ المؤرخة داخل الفترة",s.periodActivityUpdates],
  ["عدد مؤشرات الأداء",s.indicators],["مؤشرات لها قياس فعلي",s.measured],
  ["مؤشرات حققت المستهدف باتجاه قابل للاستنتاج",s.met],
  ["مؤشرات دون المستهدف باتجاه قابل للاستنتاج",s.notMet],
  ["مؤشرات مقاسة لكن اتجاه النجاح غير محدد",s.unassessable],
  ["قراءات المؤشرات المؤرخة داخل الفترة",s.periodKpiReadings]
 ]);
 const status:Record<string,string>={
  scheduled:"مجدول لاحقًا",completed:"مكتمل",blocked:"متعثر",
  overdue:"متأخر",in_progress:"قيد التنفيذ",unreported:"بدون تقرير"
 };
 const activity=add("الأنشطة",cols(["الهدف الاستراتيجي","النشاط","المسؤول","بداية الخطة","نهاية الخطة",
  "المستهدف","الوحدة","نسبة الإنجاز %","الفعلي التراكمي","موازنة النشاط",
  "المنصرف التراكمي","العملة","الحالة","تاريخ آخر تقرير","مرجع الدليل","ملخص الإنجاز"],
  [39,42,28,17,17,18,14,18,19,19,18,11,20,21,37,55]),
  report.activityLines.map(a=>[a.goalTitle,a.title,a.owner,a.start,a.end,a.target,a.unit,
   a.progress,a.actualQuantity,a.budget,a.spent,a.currency,status[a.flag],
   a.reportDate,a.reference,a.summary]));
 const first=2,last=report.activityLines.length+1;
 if(last>=first){
  activity.getColumn(8).numFmt="0.00";
  for(const c of [6,9,10,11])activity.getColumn(c).numFmt="#,##0.00";
 }
 add("مؤشرات الأداء",cols(["الهدف الاستراتيجي","المؤشر","الوحدة","خط الأساس",
  "المستهدف","آخر قيمة فعلية","الفارق (الفعلي - المستهدف)","اتجاه النجاح",
  "الحكم على المستهدف","تاريخ القياس","مرجع التحقق"],
  [40,42,15,20,20,21,28,24,35,19,42]),
  report.indicatorLines.map(k=>[k.goalTitle,k.title,k.unit,k.baseline,k.target,k.actual,
   k.gap,k.direction==="up"?"الارتفاع أفضل":k.direction==="down"?"الانخفاض أفضل":"غير محدد",
   k.attainment==="met"?"تحقق":k.attainment==="not_met"?"لم يتحقق":
   k.attainment==="unmeasured"?"لم يُقَس":"يتطلب تحديد اتجاه النجاح",
   k.measuredOn,k.reference]));
 add("الموازنات",cols(["العملة","إجمالي الموازنات المسجلة","إجمالي الصرف الموثق",
  "الفرق القابل للحساب","أنشطة بلا موازنة","أنشطة بلا صرف موثق"],
  [17,34,33,33,30,34]),
  report.currencies.map(c=>[c.currency,c.planned,c.spent,c.variance,c.missingPlanned,c.missingSpent]));
 add("المنهجية",cols(["الموضوع","التفسير"],[39,115]),[
  ["الاستحقاق الزمني","المسودة المرجعية المعتمدة هي أساس النشاط والمؤشر. توضع الأنشطة التي يبدأ تنفيذها بعد تاريخ القطع ضمن مجدول لاحقًا."],
  ["الفترة","التقرير الشهري أو الربعي أو السنوي يعرض الحالة التراكمية إلى تاريخ القطع، ويحسب عدد التحديثات المؤرخة ضمن الفترة بشكل منفصل."],
  ["التحديثات التراكمية","نأخذ آخر قراءة لكل نشاط أو مؤشر بحسب تاريخها الفعلي، وعند التساوي بحسب وقت تسجيلها ثم معرفها. لا تُجمع القراءة التراكمية مرتين."],
  ["بيانات متأخرة التسجيل","قد يتضمن التقرير قراءة أُدخلت لاحقًا بتاريخ واقعة سابق؛ التقرير يعكس السجل الحالي وليس بالضرورة ما كان متاحًا تاريخيًا."],
  ["القياسات المفقودة","لا تتحول القيم الغائبة إلى صفر. عدم وجود قياس لا يعني عدم الإنجاز."],
  ["معيار تحقق المؤشر","يُستنتج اتجاه النجاح فقط من اختلاف المستهدف وخط الأساس. بدونهما لا يحكم النظام بتحقق المستهدف."],
  ["الموازنة","الموازنة هي مجموع تقديرات أنشطة الخطة ككل وليست موازنة الفترة. المصروف آخر قيمة تراكمية موثقة حتى تاريخ القطع."],
  ["العملات","لا نجمع العملات المختلفة. لا نحتسب فرق الميزانية إن غاب تقدير أو صرف لأي نشاط بعملته."],
  ["تقرير الأداء","اكتمال النشاط ليس دليلًا تلقائيًا على تحقق الأثر الاستراتيجي. كل رقم فعلي يحتاج إلى مستند أو مصدر تحقق."]
 ]);
 const buffer=await book.xlsx.writeBuffer();
 const bytes=new Uint8Array(buffer);
 if(bytes.byteLength<1000)throw new Error("تعذر إنشاء ملف Excel كامل");
 const objectUrl=URL.createObjectURL(new Blob([bytes as BlobPart],{
  type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
 }));
 const link=document.createElement("a");
 link.href=objectUrl;
 link.download=`BOSLA-Plan-${plan.id.slice(0,8)}-${report.window.start}-${report.asOf}.xlsx`;
 document.body.append(link);
 link.click();link.remove();
 window.setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
}
