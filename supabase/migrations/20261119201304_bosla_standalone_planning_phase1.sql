-- Strategic Planning Studio - standalone schema.
-- Apply only to a NEW, independent Supabase project after review.
-- IMPORTANT: this migration intentionally does not reference any ENJAZ AI table.
create schema if not exists private;
grant usage on schema private to authenticated;

create table public.planning_profiles (
 id uuid primary key references auth.users(id),
 full_name text not null check(char_length(btrim(full_name)) between 2 and 120),
 created_at timestamptz not null default now()
);
create table public.planning_organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(btrim(name)) between 2 and 200),
 owner_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(id,owner_id)
);
create table public.planning_workshops (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.planning_organizations(id),
 title text not null check(char_length(btrim(title)) between 2 and 200),
 planning_year integer not null check(planning_year between 2020 and 2200),
 workshop_date date not null,
 created_by uuid not null references auth.users(id),
 invite_hash text not null check(char_length(invite_hash)=64),
 allow_individual boolean not null default false,
 open_stages smallint[] not null default array[1]::smallint[],
 vote_open boolean not null default false,
 status text not null default 'active' check(status in ('active','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,organization_id),
 check(open_stages <@ array[1,2,3,4,5]::smallint[])
);
create index planning_workshops_org_idx on public.planning_workshops(organization_id);
create unique index planning_workshops_invite_hash_idx on public.planning_workshops(invite_hash);

create table public.planning_groups (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 workshop_id uuid not null,
 name text not null check(char_length(btrim(name)) between 1 and 100),
 created_at timestamptz not null default now(),
 unique(id,workshop_id,organization_id),
 unique(workshop_id,name),
 foreign key(workshop_id,organization_id) references public.planning_workshops(id,organization_id)
);
create table public.planning_participants (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 workshop_id uuid not null,
 user_id uuid not null references auth.users(id),
 group_id uuid,
 workshop_role text not null default 'participant'
  check(workshop_role in ('participant','facilitator')),
 is_recorder boolean not null default false,
 display_name text not null,
 created_at timestamptz not null default now(),
 unique(workshop_id,user_id),
 foreign key(workshop_id,organization_id) references public.planning_workshops(id,organization_id),
 foreign key(group_id,workshop_id,organization_id) references public.planning_groups(id,workshop_id,organization_id),
 check(not is_recorder or group_id is not null)
);
create index planning_participants_workshop_idx on public.planning_participants(workshop_id);
create table public.planning_answers (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 workshop_id uuid not null,
 stage smallint not null check(stage between 1 and 5),
 field_key text not null check(char_length(field_key) between 2 and 80),
 -- Only the agreed five workshop models may be saved (28 defined fields).
 constraint planning_answers_stage_field_check check (
   (stage=1 and field_key in ('teams','resources','scope','locations','target_groups','services','achievements','challenges')) or
   (stage=2 and field_key in ('strengths','weaknesses','opportunities','threats','priorities')) or
   (stage=3 and field_key in ('goals','goal_priorities','expected_results')) or
   (stage=4 and field_key in ('programs','projects','activities','beneficiaries','timelines','responsibilities','estimated_costs')) or
   (stage=5 and field_key in ('kpis','baselines','targets','verification','followup'))
 ),
 scope text not null check(scope in ('group','individual')),
 owner_id uuid not null,
 content text not null default '' check(char_length(content)<=30000),
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workshop_id,stage,field_key,scope,owner_id),
 unique(id,workshop_id,organization_id),
 foreign key(workshop_id,organization_id) references public.planning_workshops(id,organization_id)
);
create index planning_answers_workshop_idx on public.planning_answers(workshop_id,stage);
create table public.planning_priorities (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 workshop_id uuid not null,
 source_answer_id uuid not null,
 label text not null check(char_length(btrim(label)) between 1 and 500),
 normalized_label text not null check(char_length(normalized_label) between 1 and 500),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(workshop_id,normalized_label),
 unique(id,workshop_id,organization_id),
 foreign key(workshop_id,organization_id) references public.planning_workshops(id,organization_id),
 foreign key(source_answer_id,workshop_id,organization_id)
  references public.planning_answers(id,workshop_id,organization_id)
);
create table public.planning_votes (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 workshop_id uuid not null,
 priority_id uuid not null,
 user_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(priority_id,user_id),
 foreign key(workshop_id,organization_id) references public.planning_workshops(id,organization_id),
 foreign key(priority_id,workshop_id,organization_id)
  references public.planning_priorities(id,workshop_id,organization_id)
);
create index planning_votes_workshop_idx on public.planning_votes(workshop_id);

-- SECURITY DEFINER is used ONLY for internal membership lookups and joining;
-- it is held in non-exposed private schema with a fixed, empty search path.
create or replace function private.planning_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.planning_organizations o
 where o.id=p_org and o.owner_id=(select auth.uid()));
$$;
create or replace function private.planning_member(p_workshop uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.planning_workshops w
 where w.id=p_workshop and (
  private.planning_owner(w.organization_id) or exists (
   select 1 from public.planning_participants m
   where m.workshop_id=w.id and m.organization_id=w.organization_id
    and m.user_id=(select auth.uid())
  )
 ));
$$;
create or replace function private.planning_manager(p_workshop uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.planning_workshops w
 where w.id=p_workshop and (
  private.planning_owner(w.organization_id) or exists (
   select 1 from public.planning_participants m
   where m.workshop_id=w.id and m.organization_id=w.organization_id
    and m.user_id=(select auth.uid()) and m.workshop_role='facilitator'
  )
 ));
$$;
create or replace function private.planning_can_edit(
 p_workshop uuid,p_org uuid,p_stage smallint,p_scope text,p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.planning_workshops w
 where w.id=p_workshop and w.organization_id=p_org and w.status='active'
  and private.planning_member(w.id)
  and (private.planning_manager(w.id) or p_stage=any(w.open_stages))
  and ((p_scope='individual' and p_owner=(select auth.uid())
    and (w.allow_individual or private.planning_manager(w.id)))
  or (p_scope='group' and exists(select 1 from public.planning_groups g
    where g.id=p_owner and g.workshop_id=w.id and g.organization_id=w.organization_id)
    and (private.planning_manager(w.id) or exists(
      select 1 from public.planning_participants m
      where m.user_id=(select auth.uid()) and m.workshop_id=w.id
       and m.organization_id=w.organization_id and m.group_id=p_owner and m.is_recorder
    )))));
$$;

create or replace function private.planning_join_by_code_checked(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_workshop uuid; v_org uuid; v_name text;
begin
 if (select auth.uid()) is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
 if char_length(p_code)<40 or char_length(p_code)>140 then
  raise exception 'رمز الدعوة غير صحيح';
 end if;
 select w.id,w.organization_id,p.full_name into v_workshop,v_org,v_name
 from public.planning_workshops w
 join public.planning_profiles p on p.id=(select auth.uid())
 where w.status='active' and w.invite_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex')
 limit 1;
 if v_workshop is null then raise exception 'الرمز غير صالح أو الورشة مغلقة'; end if;
 insert into public.planning_participants(organization_id,workshop_id,user_id,display_name)
 values(v_org,v_workshop,(select auth.uid()),v_name)
 on conflict(workshop_id,user_id) do nothing;
 return v_workshop;
end;
$$;
create or replace function public.planning_join_by_code(p_code text)
returns uuid language sql security invoker set search_path = '' as $$
 select private.planning_join_by_code_checked(p_code);
$$;

create or replace function private.planning_answer_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if tg_op='UPDATE' then
  if new.organization_id<>old.organization_id or new.workshop_id<>old.workshop_id
   or new.stage<>old.stage or new.field_key<>old.field_key or new.scope<>old.scope
   or new.owner_id<>old.owner_id or new.created_by<>old.created_by then
    raise exception 'لا يمكن نقل الإجابة بين ورش أو مراحل أو أصحاب';
  end if;
 else new.created_by:=auth.uid(); end if;
 if not private.planning_can_edit(new.workshop_id,new.organization_id,
    new.stage,new.scope,new.owner_id) then
  raise exception 'المرحلة مغلقة أو لا تملك صلاحية تعديل الإجابة';
 end if;
 new.updated_by:=auth.uid();new.updated_at:=now();return new;
end; $$;
create trigger planning_answer_guard before insert or update on public.planning_answers
for each row execute function private.planning_answer_guard();

create or replace function private.planning_identity_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
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
create trigger planning_workshop_identity before update on public.planning_workshops
for each row execute function private.planning_identity_guard();
create trigger planning_participant_identity before update on public.planning_participants
for each row execute function private.planning_identity_guard();
create trigger planning_group_identity before update on public.planning_groups
for each row execute function private.planning_identity_guard();

alter table public.planning_profiles enable row level security;
alter table public.planning_organizations enable row level security;
alter table public.planning_workshops enable row level security;
alter table public.planning_groups enable row level security;
alter table public.planning_participants enable row level security;
alter table public.planning_answers enable row level security;
alter table public.planning_priorities enable row level security;
alter table public.planning_votes enable row level security;

create policy planning_profile_self_read on public.planning_profiles for select
 to authenticated using(id=(select auth.uid()));
create policy planning_profile_self_insert on public.planning_profiles for insert
 to authenticated with check(id=(select auth.uid()));
create policy planning_profile_self_update on public.planning_profiles for update
 to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy planning_org_owner_read on public.planning_organizations for select
 to authenticated using(owner_id=(select auth.uid()));
create policy planning_org_owner_insert on public.planning_organizations for insert
 to authenticated with check(owner_id=(select auth.uid()));
create policy planning_org_owner_edit on public.planning_organizations for update
 to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));

create policy planning_workshop_read on public.planning_workshops for select
 to authenticated using(private.planning_member(id));
create policy planning_workshop_insert on public.planning_workshops for insert
 to authenticated with check(created_by=(select auth.uid())
 and private.planning_owner(organization_id));
create policy planning_workshop_edit on public.planning_workshops for update
 to authenticated using(private.planning_manager(id)) with check(private.planning_manager(id));

create policy planning_groups_read on public.planning_groups for select
 to authenticated using(private.planning_member(workshop_id));
create policy planning_groups_insert on public.planning_groups for insert
 to authenticated with check(private.planning_manager(workshop_id));
create policy planning_groups_edit on public.planning_groups for update
 to authenticated using(private.planning_manager(workshop_id)) with check(private.planning_manager(workshop_id));

create policy planning_participants_read on public.planning_participants for select
 to authenticated using(private.planning_member(workshop_id));
create policy planning_participants_edit on public.planning_participants for update
 to authenticated using(private.planning_manager(workshop_id))
 with check(private.planning_manager(workshop_id));
-- Participants INSERT is ONLY through the narrowly checked join RPC.

create policy planning_answers_read on public.planning_answers for select
 to authenticated using(private.planning_manager(workshop_id) or
 (private.planning_member(workshop_id) and
  ((scope='individual' and owner_id=(select auth.uid())) or
   (scope='group' and exists(select 1 from public.planning_participants m
    where m.workshop_id=planning_answers.workshop_id
     and m.user_id=(select auth.uid()) and m.group_id=planning_answers.owner_id)))));
create policy planning_answers_insert on public.planning_answers for insert
 to authenticated with check(private.planning_can_edit(workshop_id,organization_id,stage,scope,owner_id)
 and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy planning_answers_edit on public.planning_answers for update
 to authenticated using(private.planning_can_edit(workshop_id,organization_id,stage,scope,owner_id))
 with check(private.planning_can_edit(workshop_id,organization_id,stage,scope,owner_id));

create policy planning_priorities_read on public.planning_priorities for select
 to authenticated using(private.planning_member(workshop_id));
create policy planning_priorities_insert on public.planning_priorities for insert
 to authenticated with check(private.planning_manager(workshop_id)
  and created_by=(select auth.uid())
  and exists(select 1 from public.planning_answers a
    where a.id=source_answer_id and a.workshop_id=planning_priorities.workshop_id
    and a.organization_id=planning_priorities.organization_id and a.stage=2
    and a.field_key='priorities'));
create policy planning_votes_read on public.planning_votes for select
 to authenticated using(private.planning_member(workshop_id));
create policy planning_votes_insert on public.planning_votes for insert
 to authenticated with check(user_id=(select auth.uid()) and private.planning_member(workshop_id)
 and exists(select 1 from public.planning_workshops w
   where w.id=workshop_id and w.organization_id=planning_votes.organization_id
   and w.status='active' and w.vote_open));
create policy planning_votes_delete on public.planning_votes for delete
 to authenticated using(user_id=(select auth.uid()) and private.planning_member(workshop_id)
 and exists(select 1 from public.planning_workshops w
   where w.id=workshop_id and w.organization_id=planning_votes.organization_id
   and w.status='active' and w.vote_open));

revoke all on public.planning_profiles,public.planning_organizations,public.planning_workshops,
 public.planning_groups,public.planning_participants,public.planning_answers,
 public.planning_priorities,public.planning_votes from anon;
grant select,insert,update on public.planning_profiles to authenticated;
grant select,insert,update on public.planning_organizations to authenticated;
grant select,insert,update on public.planning_workshops to authenticated;
grant select,insert,update on public.planning_groups to authenticated;
grant select,update on public.planning_participants to authenticated;
grant select,insert,update on public.planning_answers to authenticated;
grant select,insert on public.planning_priorities to authenticated;
grant select,insert,delete on public.planning_votes to authenticated;

-- Prevent anonymous access to privileged helpers.
revoke all on function public.planning_join_by_code(text) from public,anon;
revoke all on function private.planning_join_by_code_checked(text) from public,anon;
revoke all on function private.planning_owner(uuid) from public,anon;
revoke all on function private.planning_member(uuid) from public,anon;
revoke all on function private.planning_manager(uuid) from public,anon;
revoke all on function private.planning_can_edit(uuid,uuid,smallint,text,uuid) from public,anon;
grant execute on function public.planning_join_by_code(text) to authenticated;
grant execute on function private.planning_join_by_code_checked(text) to authenticated;
grant execute on function private.planning_owner(uuid) to authenticated;
grant execute on function private.planning_member(uuid) to authenticated;
grant execute on function private.planning_manager(uuid) to authenticated;
grant execute on function private.planning_can_edit(uuid,uuid,smallint,text,uuid) to authenticated;

-- No sample data, users or institutions are inserted by this migration.
