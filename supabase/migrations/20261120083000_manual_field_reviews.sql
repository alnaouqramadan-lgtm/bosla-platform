create table public.planning_form_reviews (
 workshop_id uuid references public.planning_workshops(id) on delete cascade,
 stage integer check(stage between 1 and 5),
 fields jsonb not null default '{}', revision integer not null default 0,
 finalized_by uuid, finalized_at timestamptz, primary key(workshop_id,stage)
);
alter table public.planning_form_reviews enable row level security;
revoke all on public.planning_form_reviews from public,anon,authenticated;
grant select on public.planning_form_reviews to authenticated;
create policy review_managers on public.planning_form_reviews for select to authenticated using(private.planning_manager(workshop_id));
create function public.planning_save_form_review(p_workshop uuid,p_stage integer,p_revision integer,p_action text,p_key text default null,p_content text default null,p_answer uuid default null,p_source_time timestamptz default null)
returns public.planning_form_reviews language plpgsql security definer set search_path='' as $$
declare
 row_data public.planning_form_reviews;
 source_row record;
 item jsonb;
 required_keys text[];
begin
 if auth.uid() is null or not coalesce(private.planning_manager(p_workshop),false) then raise exception 'الاعتماد متاح لميسّر الورشة فقط'; end if;
 perform 1 from public.planning_workshops where id=p_workshop and status='active' for share;
 if not found then raise exception 'الورشة غير نشطة'; end if;
 required_keys:=case p_stage
 when 1 then array['teams','resources','scope','locations','target_groups','services','achievements','challenges']
 when 2 then array['strengths','weaknesses','opportunities','threats','priorities']
 when 3 then array['goals','goal_priorities','expected_results']
 when 4 then array['programs','projects','activities','beneficiaries','timelines','responsibilities','estimated_costs']
 when 5 then array['kpis','baselines','targets','verification','followup']
 end;
 if required_keys is null then raise exception 'النموذج غير صالح'; end if;
 insert into public.planning_form_reviews(workshop_id,stage) values(p_workshop,p_stage) on conflict do nothing;
 select * into strict row_data from public.planning_form_reviews where workshop_id=p_workshop and stage=p_stage for update;
 if row_data.revision is distinct from p_revision then raise exception 'تغيّرت المراجعة. حدّث البيانات وراجع التغييرات قبل الحفظ.'; end if;
 if row_data.finalized_at is not null then raise exception 'النموذج معتمد نهائيًا'; end if;
 if p_action='finalize' then
  if exists(select 1 from unnest(required_keys) k where (row_data.fields->k->>'status') is distinct from 'approved') then raise exception 'اعتمد جميع الخانات أولًا'; end if;
  row_data.finalized_at:=now(); row_data.finalized_by:=auth.uid();
 elsif p_action in ('draft','approve') then
  if p_key is null or not(p_key=any(required_keys)) or coalesce(length(trim(p_content)),0) not between 1 and 30000 then raise exception 'تحقق من نص الخانة'; end if;
  item:=row_data.fields->p_key;
  if p_answer is not null and not coalesce((item->>'answer_id')=p_answer::text and (item->>'source_time')::timestamptz=p_source_time,false) then
   select a.id,a.content,a.updated_at,g.name,g.id as group_id into source_row from public.planning_answers a join public.planning_groups g on g.id=a.owner_id
   where a.id=p_answer and a.workshop_id=p_workshop and g.workshop_id=p_workshop and a.stage=p_stage and a.field_key=p_key and a.scope='group';
   if not found or source_row.updated_at is distinct from p_source_time then raise exception 'تغيّرت إجابة المجموعة. حدّث البيانات وراجع النص.'; end if;
   item:=jsonb_build_object('answer_id',p_answer,'source_time',source_row.updated_at,'source_text',source_row.content,'group_name',source_row.name,'group_id',source_row.group_id);
  elsif p_answer is null then item:='{}'; end if;
  item:=item||jsonb_build_object('content',trim(p_content),'status',case when p_action='approve' then 'approved' else 'draft' end,'author',auth.uid(),'updated_at',now());
  row_data.fields:=jsonb_set(row_data.fields,array[p_key],item);
 else raise exception 'إجراء غير صالح'; end if;
 update public.planning_form_reviews set fields=row_data.fields,revision=revision+1,finalized_at=row_data.finalized_at,finalized_by=row_data.finalized_by where workshop_id=p_workshop and stage=p_stage returning * into row_data;
 return row_data;
end $$;
revoke all on function public.planning_save_form_review(uuid,integer,integer,text,text,text,uuid,timestamptz) from public,anon;
grant execute on function public.planning_save_form_review(uuid,integer,integer,text,text,text,uuid,timestamptz) to authenticated;
