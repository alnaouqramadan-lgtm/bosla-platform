export type ReviewedField = {
 content:string;
 status:"draft"|"approved";
 answer_id?:string;
 source_time?:string;
 source_text?:string;
 group_name?:string;
 source_kind?:string;
 author:string;
 updated_at:string;
};

export type FormReview = {
 stage:number;
 fields:Record<string,ReviewedField>;
 revision:number;
 finalized_at:string|null;
 finalized_by:string|null;
};

export function reviewSource(field:{group_name?:string;source_kind?:string}){
 return field.source_kind==="individual"?"الإدخال الفردي للميسّر":field.group_name??"صياغة الميسّر";
}
