-- BOSLA AI: owner-controlled publication and append-only delivery measurements.
-- Existing workshops and draft planning data remain intact.
alter table public.planning_strategic_plans
 drop constraint if exists planning_strategic_plans_status_check;
alter table public.planning_strategic_plans
 add constraint planning_strategic_plans_status_check
 check (status in ('draft','approved'));

-- A formally published baseline is captured once and remains immutable for audit.
create table public.planning_plan_revisions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 plan_id uuid not null,
 version integer not null check (version>=1),
 approved_at timestamptz not null default now(),
 approved_by uuid not null references auth.users(id),
 snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
 constraint planning_plan_revisions_plan_fkey foreign key(plan_id,organization_id)
  references public.planning_strategic_plans(id,organization_id) on delete restrict,
 constraint planning_plan_revisions_plan_version_unique unique(plan_id,version)
);
create index planning_plan_revisions_plan_idx on public.planning_plan_revisions(plan_id,approved_at desc);
alter table public.planning_plan_revisions enable row level security;
revoke all on public.planning_plan_revisions from public,anon,authenticated;
grant select on public.planning_plan_revisions to authenticated;
create policy planning_plan_revisions_owner_read on public.planning_plan_revisions for select to authenticated
 using(private.planning_owner(organization_id));

-- Record cumulative actuals. The latest recorded update is the current delivery state;
-- neither spending nor beneficiary counts are summed across cumulative updates.
alter table public.planning_operational_activities
 add constraint planning_operational_activities_progress_identity unique(id,plan_id,organization_id);
alter table public.planning_performance_indicators
 add constraint planning_performance_indicators_measurement_identity unique(id,plan_id,organization_id);

create table public.planning_activity_progress (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 plan_id uuid not null,
 activity_id uuid not null,
 reported_by uuid not null default auth.uid() references auth.users(id),
 report_date date not null default current_date,
 progress_percent numeric(5,2) not null check(progress_percent between 0 and 100),
 actual_quantity_to_date numeric(16,2) check(actual_quantity_to_date>=0),
 spent_to_date numeric(16,2) check(spent_to_date>=0),
 delivery_status text not null default 'in_progress'
  check(delivery_status in ('in_progress','completed','blocked')),
 summary text not null default '',
 evidence_reference text not null check(char_length(btrim(evidence_reference)) between 3 and 500),
 created_at timestamptz not null default now(),
 constraint planning_activity_progress_activity_fkey foreign key(activity_id,plan_id,organization_id)
  references public.planning_operational_activities(id,plan_id,organization_id) on delete restrict,
 constraint planning_activity_progress_plan_fkey foreign key(plan_id,organization_id)
  references public.planning_strategic_plans(id,organization_id) on delete restrict,
 constraint planning_activity_progress_completion_check
  check (delivery_status<>'completed' or progress_percent=100)
);
create index planning_activity_progress_lookup_idx on public.planning_activity_progress(plan_id,activity_id,created_at desc);

create table public.planning_kpi_measurements (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 plan_id uuid not null,
 indicator_id uuid not null,
 measured_by uuid not null default auth.uid() references auth.users(id),
 measured_on date not null default current_date,
 actual_value numeric(18,3) not null,
 evidence_reference text not null check(char_length(btrim(evidence_reference)) between 3 and 500),
 notes text not null default '',
 created_at timestamptz not null default now(),
 constraint planning_kpi_measurements_indicator_fkey foreign key(indicator_id,plan_id,organization_id)
  references public.planning_performance_indicators(id,plan_id,organization_id) on delete restrict,
 constraint planning_kpi_measurements_plan_fkey foreign key(plan_id,organization_id)
  references public.planning_strategic_plans(id,organization_id) on delete restrict
);
create index planning_kpi_measurements_lookup_idx on public.planning_kpi_measurements(plan_id,indicator_id,created_at desc);

alter table public.planning_activity_progress enable row level security;
alter table public.planning_kpi_measurements enable row level security;
revoke all on public.planning_activity_progress,public.planning_kpi_measurements from public,anon,authenticated;
grant select,insert on public.planning_activity_progress,public.planning_kpi_measurements to authenticated;

create policy planning_activity_progress_owner_read on public.planning_activity_progress for select to authenticated
 using(private.planning_owner(organization_id));
create policy planning_activity_progress_owner_insert on public.planning_activity_progress for insert to authenticated
 with check(
  private.planning_owner(organization_id)
  and reported_by=(select auth.uid())
  and exists(select 1 from public.planning_strategic_plans p
             where p.id=plan_id and p.organization_id=organization_id and p.status='approved')
 );
create policy planning_kpi_measurements_owner_read on public.planning_kpi_measurements for select to authenticated
 using(private.planning_owner(organization_id));
create policy planning_kpi_measurements_owner_insert on public.planning_kpi_measurements for insert to authenticated
 with check(
  private.planning_owner(organization_id)
  and measured_by=(select auth.uid())
  and exists(select 1 from public.planning_strategic_plans p
             where p.id=plan_id and p.organization_id=organization_id and p.status='approved')
 );

-- This protected function is not exposed through the REST API schema.
-- All approval checks and snapshot capture happen in a single DB transaction.
create function private.planning_publish_plan(p_plan uuid)
returns public.planning_plan_revisions
language plpgsql security definer
set search_path=''
as $$
declare
 p public.planning_strategic_plans;
 approved public.planning_plan_revisions;
 content jsonb;
begin
 if auth.uid() is null then
  raise exception 'يجب تسجيل الدخول لاعتماد الخطة';
 end if;
 select * into p from public.planning_strategic_plans where id=p_plan for update;
 if not found or not private.planning_owner(p.organization_id) then
  raise exception 'ليس لديك إذن اعتماد هذه الخطة';
 end if;
 if p.status<>'draft' then
  raise exception 'هذه الخطة معتمدة بالفعل ولا يمكن إعادة اعتمادها دون إصدار جديد';
 end if;
 if length(btrim(p.vision))<3 or length(btrim(p.mission))<3 then
  raise exception 'الرؤية والرسالة مطلوبتان قبل اعتماد الخطة';
 end if;
 if not exists(select 1 from public.planning_strategic_goals g where g.plan_id=p.id) then
  raise exception 'أضف هدفاً استراتيجياً واحداً على الأقل';
 end if;
 if not exists(select 1 from public.planning_operational_activities a where a.plan_id=p.id) then
  raise exception 'أضف نشاطاً تشغيلياً واحداً على الأقل';
 end if;
 if not exists(select 1 from public.planning_performance_indicators k where k.plan_id=p.id) then
  raise exception 'أضف مؤشراً واحداً على الأقل';
 end if;
 if exists(select 1 from public.planning_performance_indicators k
           where k.plan_id=p.id and
            (k.target is null or length(btrim(k.verification_source))=0)) then
  raise exception 'حدد المستهدف ومصدر التحقق لجميع مؤشرات الأداء';
 end if;
 -- The owning account approves/publishes its institutional baseline.
 -- A distinct independent reviewer is not implied by this approval.
 update public.planning_strategic_plans set status='approved'
 where id=p.id returning * into p;
 content:=jsonb_build_object(
  'plan',to_jsonb(p),
  'goals',coalesce((select jsonb_agg(to_jsonb(g) order by g.sort_order,g.created_at,g.id)
    from public.planning_strategic_goals g where g.plan_id=p.id),'[]'::jsonb),
  'activities',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at,a.id)
    from public.planning_operational_activities a where a.plan_id=p.id),'[]'::jsonb),
  'indicators',coalesce((select jsonb_agg(to_jsonb(k) order by k.created_at,k.id)
    from public.planning_performance_indicators k where k.plan_id=p.id),'[]'::jsonb)
 );
 insert into public.planning_plan_revisions(organization_id,plan_id,version,approved_by,snapshot)
 values(p.organization_id,p.id,1,auth.uid(),content) returning * into approved;
 return approved;
end $$;
revoke all on function private.planning_publish_plan(uuid) from public,anon;
grant execute on function private.planning_publish_plan(uuid) to authenticated;

-- Exposed RPC wrapper remains invoker; privilege elevation stays inside private schema.
create function public.planning_publish_plan(p_plan uuid)
returns public.planning_plan_revisions
language sql security invoker set search_path=''
as $$ select private.planning_publish_plan(p_plan) $$;
revoke all on function public.planning_publish_plan(uuid) from public,anon;
grant execute on function public.planning_publish_plan(uuid) to authenticated;
