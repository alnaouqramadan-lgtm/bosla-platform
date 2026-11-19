export type Organization = {id:string; name:string; owner_id:string};
export type Membership = {id:string; organization_id:string; user_id:string; role:"owner"|"member"};
export type Workshop = {
  id:string; organization_id:string; title:string; planning_year:number; workshop_date:string;
  created_by:string; open_stages:number[]; allow_individual:boolean; vote_open:boolean;
  status:"active"|"archived";
};
export type Group = {id:string; organization_id:string; workshop_id:string; name:string};
export type Participant = {
  id:string; organization_id:string; workshop_id:string; user_id:string;
  group_id:string|null; workshop_role:"facilitator"|"participant";
  is_recorder:boolean; display_name:string;
};
export type Answer = {
  id:string; organization_id:string; workshop_id:string; stage:number; field_key:string;
  scope:"group"|"individual"; owner_id:string; content:string;
  created_by:string; updated_by:string; updated_at:string;
};
export type Priority = {
  id:string; organization_id:string; workshop_id:string; source_answer_id:string;
  label:string; normalized_label:string;
};
export type Vote = {id:string; organization_id:string; workshop_id:string; priority_id:string; user_id:string};
