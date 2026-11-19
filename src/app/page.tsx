import Link from "next/link";
export default function Home(){return <main className="wrap" style={{minHeight:"100vh",display:"grid",alignContent:"center",maxWidth:720}}>
<section className="card" style={{padding:34,textAlign:"center"}}>
<div style={{fontSize:42}}>🧭</div><h1>بوصلة | BOSLA AI</h1>
<p>المنصة الذكية للتخطيط الاستراتيجي والتشغيلي وتحليل البيئة المؤسسية.</p>
<p>خمس مراحل • مجموعات عمل • حفظ تلقائي • أولويات وتصويت • Excel وطباعة</p>
<Link href="/login" className="primary" style={{display:"inline-block",textDecoration:"none",marginTop:12}}>دخول المنصة</Link>
</section></main>}
