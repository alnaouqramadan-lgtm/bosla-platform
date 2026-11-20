-- BOSLA AI: first institutional strategy/operations planning module.
-- Additive only. Existing workshop records and RLS remain untouched.
create table if not exists public.planning_strategic_plans (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.planning_organizations(id),
 source_workshop_id uuid,
 created_by uuid not null default auth.uid() references auth.users(id),
 title text not null check (char_length(btrim(title)) between 3 and 200),
 period_start date not null,
 period_end date not null,
 vision text not null default '',
 mission text not null default '',
 institutional_values text not null default '',
 environmental_analysis text not null default '',
 status text not null default 'draft' check (status='draft'),
 revision integer not null default 1 check(revision>=1),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint planning_strategic_plans_dates check(period_end>=period_start),
 constraint planning_strategic_plans_id_org_unique unique(id,organization_id),
 constraint planning_strategic_plans_source_org_fkey foreign key(source_workshop_id,organization_id)
  references public.planning_workshops(id,organization_id)
);
create index if not exists planning_strategic_plans_org_idx on public.planning_strategic_plans(organization_id,created_at desc);

create table if not exists public.planning_strategic_goals (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null,
 organization_id uuid not null,
 code text not null default '' check(length(code)<=30),
 title text not null check(char_length(btrim(title)) between 3 and 300),
 description text not null default '',
 strategic_axis text not null default '',
 priority smallint not null default 3 check(priority between 1 and 5),
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 constraint planning_strategic_goals_plan_fkey foreign key(plan_id,organization_id)
   references public.planning_strategic_plans(id,organization_id) on delete cascade,
 constraint planning_strategic_goals_link_key unique(id,plan_id,organization_id),
 constraint planning_strategic_goals_title_unique unique(plan_id,title)
);
create index if not exists planning_strategic_goals_plan_idx on public.planning_strategic_goals(plan_id,sort_order);

create table if not exists public.planning_operational_activities (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 plan_id uuid not null,
 goal_id uuid not null,
 program_name text not null default '',
 project_name text not null default '',
 title text not null check(char_length(btrim(title)) between 3 and 300),
 target_group text not null default '',
 target_quantity numeric(16,2) check(target_quantity>=0),
 target_unit text not null default '',
 owner_name text not null default '',
 planned_start date,
 planned_end date,
 estimated_budget numeric(16,2) check(estimated_budget>=0),
 currency_code text not null default 'ILS' check(currency_code in ('ILS','USD','EUR','JOD','EGP')),
 risk_notes text not null default '',
 status text not null default 'planned' check(status='planned'),
 created_at timestamptz not null default now(),
 constraint planning_operational_activities_plan_fkey foreign key(plan_id,organization_id)
   references public.planning_strategic_plans(id,organization_id) on delete cascade,
 constraint planning_operational_activities_goal_fkey foreign key(goal_id,plan_id,organization_id)
   references public.planning_strategic_goals(id,plan_id,organization_id) on delete restrict,
 constraint planning_operational_activities_dates check(planned_start is null or planned_end is null or planned_end>=planned_start)
);
create index if not exists planning_operational_activities_plan_goal_idx on public.planning_operational_activities(plan_id,goal_id);

create table if not exists public.planning_performance_indicators (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 plan_id uuid not null,
 goal_id uuid not null,
 title text not null check(char_length(btrim(title)) between 3 and 300),
 unit text not null default '',
 baseline numeric(18,3),
 target numeric(18,3),
 verification_source text not null default '',
 frequency text not null default 'quarterly' check(frequency in ('monthly','quarterly','semiannual','annual')),
 methodology text not null default '',
 created_at timestamptz not null default now(),
 constraint planning_performance_indicators_plan_fkey foreign key(plan_id,organization_id)
   references public.planning_strategic_plans(id,organization_id) on delete cascade,
 constraint planning_performance_indicators_goal_fkey foreign key(goal_id,plan_id,organization_id)
   references public.planning_strategic_goals(id,plan_id,organization_id) on delete cascade
);
create index if not exists planning_performance_indicators_plan_goal_idx on public.planning_performance_indicators(plan_id,goal_id);

-- An update must never silently switch a record's tenant or parent. 
create or replace function private.planning_guard_new_plan_identity()
returns trigger language plpgsql set search_path='' as $$
begin
 if old.id is distinct from new.id
   or old.organization_id is distinct from new.organization_id
   or old.created_by is distinct from new.created_by
   or old.source_workshop_id is distinct from new.source_workshop_id
 then raise exception 'لا يمكن نقل الخطة بين المؤسسات أو تغيير مصدرها';
 end if;
 new.updated_at:=now();
 new.revision:=old.revision+1;
 return new;
end $$;
drop trigger if exists bosla_plan_identity_guard on public.planning_strategic_plans;
create trigger bosla_plan_identity_guard before update on public.planning_strategic_plans
 for each row execute function private.planning_guard_new_plan_identity();

create or replace function private.planning_guard_parent_identity()
returns trigger language plpgsql set search_path='' as $$
begin
 if old.id is distinct from new.id
   or old.organization_id is distinct from new.organization_id
   or old.plan_id is distinct from new.plan_id
 then raise exception 'لا يمكن تغيير المؤسسة أو الخطة الأم';
 end if;
 return new;
end $$;
drop trigger if exists bosla_goal_identity_guard on public.planning_strategic_goals;
create trigger bosla_goal_identity_guard before update on public.planning_strategic_goals
 for each row execute function private.planning_guard_parent_identity();
drop trigger if exists bosla_activity_identity_guard on public.planning_operational_activities;
create trigger bosla_activity_identity_guard before update on public.planning_operational_activities
 for each row execute function private.planning_guard_parent_identity();
drop trigger if exists bosla_indicator_identity_guard on public.planning_performance_indicators;
create trigger bosla_indicator_identity_guard before update on public.planning_performance_indicators
 for each row execute function private.planning_guard_parent_identity();

alter table public.planning_strategic_plans enable row level security;
alter table public.planning_strategic_goals enable row level security;
alter table public.planning_operational_activities enable row level security;
alter table public.planning_performance_indicators enable row level security;

revoke all on public.planning_strategic_plans,public.planning_strategic_goals,
 public.planning_operational_activities,public.planning_performance_indicators from anon;
grant select,insert,update,delete on public.planning_strategic_plans,public.planning_strategic_goals,
 public.planning_operational_activities,public.planning_performance_indicators to authenticated;

create policy bosla_plans_read on public.planning_strategic_plans for select to authenticated
 using(private.planning_owner(organization_id));
create policy bosla_plans_insert on public.planning_strategic_plans for insert to authenticated
 with check(private.planning_owner(organization_id) and created_by=(select auth.uid()) and status='draft');
create policy bosla_plans_update on public.planning_strategic_plans for update to authenticated
 using(private.planning_owner(organization_id) and status='draft')
 with check(private.planning_owner(organization_id) and status='draft');
create policy bosla_plans_delete on public.planning_strategic_plans for delete to authenticated
 using(private.planning_owner(organization_id) and status='draft');

-- Each child must belong to a draft plan in the SAME tenant. Goal foreign keys
-- additionally enforce that activities/indicators cannot link across plans.
do $body$
declare tbl text; 
begin
 foreach tbl in array array['planning_strategic_goals','planning_operational_activities','planning_performance_indicators']
 loop
  execute format('create policy bosla_child_read on public.%I for select to authenticated using (private.planning_owner(organization_id) and exists (select 1 from public.planning_strategic_plans p where p.id=plan_id and p.organization_id=organization_id))',tbl);
  execute format('create policy bosla_child_insert on public.%I for insert to authenticated with check (private.planning_owner(organization_id) and exists (select 1 from public.planning_strategic_plans p where p.id=plan_id and p.organization_id=organization_id and p.status=''draft''))',tbl);
  execute format('create policy bosla_child_update on public.%I for update to authenticated using (private.planning_owner(organization_id) and exists (select 1 from public.planning_strategic_plans p where p.id=plan_id and p.organization_id=organization_id and p.status=''draft'')) with check (private.planning_owner(organization_id) and exists (select 1 from public.planning_strategic_plans p where p.id=plan_id and p.organization_id=organization_id and p.status=''draft''))',tbl);
  execute format('create policy bosla_child_delete on public.%I for delete to authenticated using (private.planning_owner(organization_id) and exists (select 1 from public.planning_strategic_plans p where p.id=plan_id and p.organization_id=organization_id and p.status=''draft''))',tbl);
 end loop;
end $body$;
