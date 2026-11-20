"use client";
import {useState} from "react";
import {ratingAxes,teamSpread,withTeamRating,type Issue,type RatingAxis,type TeamRating} from "@/lib/strategy-design";
const axes=Object.keys(ratingAxes) as RatingAxis[];
const blank={team:"",impact:0,urgency:0,confidence:0,note:""};
export default function IssueTeamRatings({issue,editable,busy,onSave}:{
 issue:Issue;editable:boolean;busy:boolean;onSave:(next:Issue)=>Promise<boolean>
}){
 const rows=issue.teamRatings??[];
 const [entry,setEntry]=useState<TeamRating>(blank);
 const [editing,setEditing]=useState(false);
 const [error,setError]=useState("");
 return <details><summary>تقديرات الفرق ({rows.length})</summary>
  {rows.length>0&&<div className="bosla-report-table-wrap"><table>
   <thead><tr><th>الفريق</th>{axes.map(axis=><th key={axis}>{ratingAxes[axis]} / 5</th>)}<th>مبرر التقدير</th>{editable&&<th>تحرير</th>}</tr></thead>
   <tbody>{rows.map(row=><tr key={row.team}><th scope="row">{row.team}</th>
    {axes.map(axis=><td key={axis}>{row[axis]}</td>)}<td>{row.note||"—"}</td>
    {editable&&<td><button type="button" disabled={busy} onClick={()=>{setEntry({...row});setEditing(true);setError("");}}>تعديل تقدير {row.team}</button></td>}
   </tr>)}</tbody>
   {rows.length>=2&&<tfoot><tr><th scope="row">الفرق بين أعلى وأدنى تقدير</th>
    {axes.map(axis=><td key={axis}>{teamSpread(rows,axis)}</td>)}<td colSpan={editable?2:1}/></tr></tfoot>}
  </table></div>}
  {rows.length<2&&<p>تظهر المقارنة بعد تسجيل تقدير فريقين للقضية.</p>}
  {editable&&<form className="stack" onSubmit={async e=>{
   e.preventDefault();
   if(!entry.team.trim()||axes.some(axis=>entry[axis]<1))return;
   const next=withTeamRating(issue,entry);
   if(!editing&&next.teamRatings?.length===rows.length){setError("يوجد تقدير لهذا الفريق. اختر تعديله من الجدول.");return;}
   if(await onSave(next)){setEntry(blank);setEditing(false);setError("");}
  }}>
   <label>اسم الفريق<input className="field" required readOnly={editing} maxLength={120} value={entry.team} onChange={e=>setEntry({...entry,team:e.target.value})}/></label>
   {axes.map(axis=><label key={axis}>{ratingAxes[axis]}<select required className="field" value={entry[axis]||""}
     onChange={e=>setEntry({...entry,[axis]:Number(e.target.value)})}><option value="">اختر درجة</option>
     {[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label>)}
   <label>مبرر التقدير أو مرجع النقاش<textarea className="field" maxLength={1000} value={entry.note} onChange={e=>setEntry({...entry,note:e.target.value})}/></label>
   {error&&<p role="alert">{error}</p>}
   <button className="primary" disabled={busy}>حفظ تقدير الفريق</button>
   {editing&&<button type="button" disabled={busy} onClick={()=>{setEntry(blank);setEditing(false);setError("");}}>إلغاء التعديل</button>}
  </form>}
 </details>;
}
