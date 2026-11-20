import type {Answer,Group,Participant,Workshop} from "@/lib/types";

export type WorksheetGroup = {
  id:string;
  number:number;
  name:string;
  members:string[];
  workshopTitle:string;
  planningYear:number;
  values:Record<string,string>;
};

// Each group is rendered independently: the export must never attribute
// one group's unapproved answer to another group.
export function worksheetGroups(
  workshop:Workshop,answers:Answer[],groups:Group[],participants:Participant[],organizationName?:string
):WorksheetGroup[]{
  const items:(Group|null)[]=groups.length?groups:[null];
  return items.map((g,index)=>{
    const values:Record<string,string>={};
    for(const a of answers){
      if(a.scope!=="group" || (g ? a.owner_id!==g.id : true))continue;
      values[a.stage+":"+a.field_key]=a.content;
    }
    return {
      id:g?.id??"unassigned",number:index+1,name:g?.name??"غير محددة",
      members:participants.filter(p=>g?p.group_id===g.id:false).map(p=>p.display_name),
      workshopTitle:organizationName?.trim()||workshop.title,planningYear:workshop.planning_year,values
    };
  });
}
export function worksheetValue(g:WorksheetGroup,stage:number,key:string):string{
  return g.values[stage+":"+key]??"";
}
export function worksheetLines(g:WorksheetGroup,stage:number,key:string,max=5):string[]{
  const raw=worksheetValue(g,stage,key);
  const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  // Do not drop overflow: it is included in the final row instead.
  if(lines.length<=max)return lines;
  return [...lines.slice(0,max-1),lines.slice(max-1).join("؛ ")];
}
export function worksheetPairs(g:WorksheetGroup,stage:number,key:string,max=4):[string,string][]{
  return worksheetLines(g,stage,key,max).map((line):[string,string]=>{
    const separator=line.match(/\s*[|\t:]\s*/);
    if(!separator)return [line,""];
    const at=separator.index??line.length;
    return [line.slice(0,at).trim(),line.slice(at+separator[0].length).trim()];
  });
}
export function worksheetGroupLabel(g:WorksheetGroup):string{
  return "المجموعة "+g.number+" — "+g.name;
}
