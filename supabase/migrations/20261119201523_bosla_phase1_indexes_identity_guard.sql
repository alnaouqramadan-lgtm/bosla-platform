-- Applied on BOSLA-AI only, project madvrkqtducoivnaaldm (2026-11-19).
-- Index optimization and immutable IDs for rows; no dependency on ENJAZ.
create index if not exists planning_answers_created_by_idx on public.planning_answers(created_by);
create index if not exists planning_answers_updated_by_idx on public.planning_answers(updated_by);
create index if not exists planning_answers_workshop_org_idx on public.planning_answers(workshop_id,organization_id);
create index if not exists planning_groups_workshop_org_idx on public.planning_groups(workshop_id,organization_id);
create index if not exists planning_organizations_owner_idx on public.planning_organizations(owner_id);
create index if not exists planning_participants_group_workshop_org_idx on public.planning_participants(group_id,workshop_id,organization_id);
create index if not exists planning_participants_user_idx on public.planning_participants(user_id);
create index if not exists planning_participants_workshop_org_idx on public.planning_participants(workshop_id,organization_id);
create index if not exists planning_priorities_created_by_idx on public.planning_priorities(created_by);
create index if not exists planning_priorities_answer_workshop_org_idx on public.planning_priorities(source_answer_id,workshop_id,organization_id);
create index if not exists planning_priorities_workshop_org_idx on public.planning_priorities(workshop_id,organization_id);
create index if not exists planning_votes_priority_workshop_org_idx on public.planning_votes(priority_id,workshop_id,organization_id);
create index if not exists planning_votes_user_idx on public.planning_votes(user_id);
create index if not exists planning_votes_workshop_org_idx on public.planning_votes(workshop_id,organization_id);
create index if not exists planning_workshops_created_by_idx on public.planning_workshops(created_by);

create or replace function private.planning_identity_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if new.id is distinct from old.id then
   raise exception 'لا يمكن تغيير معرف السجل';
 end if;
 if tg_table_name='planning_workshops' then
  if old.organization_id<>new.organization_id or old.created_by<>new.created_by then
   raise exception 'لا يمكن تغيير هوية الورشة'; end if;
  new.updated_at:=now();
 elsif tg_table_name='planning_participants' then
  if old.organization_id<>new.organization_id or old.workshop_id<>new.workshop_id
   or old.user_id<>new.user_id then raise exception 'لا يمكن نقل العضوية'; end if;
 elsif tg_table_name='planning_groups' then
  if old.organization_id<>new.organization_id or old.workshop_id<>new.workshop_id
   then raise exception 'لا يمكن نقل مجموعة إلى مؤسسة أو ورشة أخرى'; end if;
 end if;
 return new;
end; $$;

create or replace function private.planning_answer_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if tg_op='UPDATE' then
  if new.id is distinct from old.id
   or new.organization_id<>old.organization_id or new.workshop_id<>old.workshop_id
   or new.stage<>old.stage or new.field_key<>old.field_key or new.scope<>old.scope
   or new.owner_id<>old.owner_id or new.created_by<>old.created_by
   or new.created_at<>old.created_at then
    raise exception 'لا يمكن تغيير هوية الإجابة أو نقلها بين الورش';
  end if;
 else new.created_by:=auth.uid(); end if;
 if not private.planning_can_edit(new.workshop_id,new.organization_id,
    new.stage,new.scope,new.owner_id) then
  raise exception 'المرحلة مغلقة أو لا تملك صلاحية تعديل الإجابة';
 end if;
 new.updated_by:=auth.uid();new.updated_at:=now();return new;
end; $$;
