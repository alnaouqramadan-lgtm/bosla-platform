export type Field = { key: string; title: string };
export type Stage = { name: string; description: string; fields: Field[] };
export const STAGES: Stage[] = [
  { name: "أين نحن الآن؟", description: "تشخيص الواقع المؤسسي", fields: [
    {key:"teams",title:"الفرق والكوادر"},{key:"resources",title:"الموارد"},
    {key:"scope",title:"نطاق العمل"},{key:"locations",title:"المواقع"},
    {key:"target_groups",title:"الفئات المستهدفة"},{key:"services",title:"الخدمات"},
    {key:"achievements",title:"الإنجازات"},{key:"challenges",title:"التحديات"}
  ]},
  { name: "ما الذي يساعدنا وما الذي يعيقنا؟", description: "تحليل القوة والضعف والفرص والتهديدات", fields: [
    {key:"strengths",title:"نقاط القوة"},{key:"weaknesses",title:"نقاط الضعف"},
    {key:"opportunities",title:"الفرص"},{key:"threats",title:"التهديدات"},
    {key:"priorities",title:"القضايا ذات الأولوية (كل قضية في سطر مستقل)"}
  ]},
  { name: "ماذا نريد أن نحقق؟", description: "الأهداف والأولويات والنتائج", fields: [
    {key:"goals",title:"الأهداف المقترحة"},{key:"goal_priorities",title:"الأولويات"},
    {key:"expected_results",title:"النتائج المتوقعة"}
  ]},
  { name: "كيف سنحقق أهدافنا؟", description: "تخطيط البرامج والمشاريع والموارد", fields: [
    {key:"programs",title:"البرامج"},{key:"projects",title:"المشاريع"},
    {key:"activities",title:"الأنشطة"},{key:"beneficiaries",title:"المستفيدون"},
    {key:"timelines",title:"المواعيد"},{key:"responsibilities",title:"المسؤوليات"},
    {key:"estimated_costs",title:"التكاليف التقديرية"}
  ]},
  { name: "كيف نعرف أننا نجحنا؟", description: "قياس الإنجاز والتحقق", fields: [
    {key:"kpis",title:"مؤشرات الأداء"},{key:"baselines",title:"خط الأساس"},
    {key:"targets",title:"المستهدفات"},{key:"verification",title:"مصادر التحقق"},
    {key:"followup",title:"آلية المتابعة"}
  ]}
];
export function normalizeLine(s: string) {
  return s.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
export function fieldName(stage: number, key: string) {
  return STAGES[stage - 1]?.fields.find(f => f.key === key)?.title ?? key;
}
