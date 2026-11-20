-- BOSLA AI: initial multi-institution governance.
-- A member can see only approved institutional plans and evidence in their assigned organization.
-- The owner retains all edits, publication and writes in this first safe rollout.
create table public.planning_organization_members (
 organization_id uuid not null references public.planning_organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check(char_length(btrim(display_name)) between 2 and 200),
 role text not null check(role in ('planner','executive_reviewer','board_viewer')),
 status text not null default 'active' check(status in ('active','suspended')),
 added_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(organization_id,user_id)
);
create index planning_organization_members_user_idx
 on public.planning_organization_members(user_id,organization_id) where status='active';
alter table public.planning_organization_members enable row level security;
revoke all on public.planning_organization_members from public,anon,authenticated;
grant select,insert,update,delete on public.planning_organization_members to authenticated;
create policy planning_members_owner_or_self_read on public.planning_organization_members
 for select to authenticated
 using (private.planning_owner(organization_id) or user_id=(select auth.uid()));
create policy planning_members_owner_insert on public.planning_organization_members
 for insert to authenticated
 with check(private.planning_owner(organization_id) and added_by=(select auth.uid()));
create policy planning_members_owner_update on public.planning_organization_members
 for update to authenticated
 using(private.planning_owner(organization_id))
 with check(private.planning_owner(organization_id));
create policy planning_members_owner_delete on public.planning_organization_members
 for delete to authenticated using(private.planning_owner(organization_id));

-- Private helper bypasses table RLS only to evaluate one checked membership, not to read tenant records.
create function private.planning_active_organization_member(p_organization uuid)
 returns boolean language sql stable security definer set search_path=''
 as $$
 select (select auth.uid()) is not null and exists(
  select 1 from public.planning_organization_members m
  where m.organization_id=p_organization and m.user_id=(select auth.uid()) and m.status='active'
 );
 $$;
revoke all on function private.planning_active_organization_member(uuid) from public,anon;
grant execute on function private.planning_active_organization_member(uuid) to authenticated;

-- Members may discover their own organization and read its published strategy, never drafts.
create policy planning_organization_member_read on public.planning_organizations
 for select to authenticated using(private.planning_active_organization_member(id));
create policy planning_approved_plan_member_read on public.planning_strategic_plans
 for select to authenticated
 using(status='approved' and private.planning_active_organization_member(organization_id));
create policy planning_approved_goal_member_read on public.planning_strategic_goals
 for select to authenticated
 using(private.planning_active_organization_member(organization_id) and exists(
  select 1 from public.planning_strategic_plans p
  where p.id=planning_strategic_goals.plan_id
   and p.organization_id=planning_strategic_goals.organization_id and p.status='approved'
 ));
create policy planning_approved_activity_member_read on public.planning_operational_activities
 for select to authenticated
 using(private.planning_active_organization_member(organization_id) and exists(
  select 1 from public.planning_strategic_plans p
  where p.id=planning_operational_activities.plan_id
   and p.organization_id=planning_operational_activities.organization_id and p.status='approved'
 ));
create policy planning_approved_kpi_member_read on public.planning_performance_indicators
 for select to authenticated
 using(private.planning_active_organization_member(organization_id) and exists(
  select 1 from public.planning_strategic_plans p
  where p.id=planning_performance_indicators.plan_id
   and p.organization_id=planning_performance_indicators.organization_id and p.status='approved'
 ));
create policy planning_approved_revision_member_read on public.planning_plan_revisions
 for select to authenticated
 using(private.planning_active_organization_member(organization_id) and exists(
  select 1 from public.planning_strategic_plans p
  where p.id=planning_plan_revisions.plan_id
   and p.organization_id=planning_plan_revisions.organization_id and p.status='approved'
 ));
create policy planning_approved_progress_member_read on public.planning_activity_progress
 for select to authenticated
 using(private.planning_active_organization_member(organization_id) and exists(
  select 1 from public.planning_strategic_plans p
  where p.id=planning_activity_progress.plan_id
   and p.organization_id=planning_activity_progress.organization_id and p.status='approved'
 ));
create policy planning_approved_measurements_member_read on public.planning_kpi_measurements
 for select to authenticated
 using(private.planning_active_organization_member(organization_id) and exists(
  select 1 from public.planning_strategic_plans p
  where p.id=planning_kpi_measurements.plan_id
   and p.organization_id=planning_kpi_measurements.organization_id and p.status='approved'
 ));

-- Defense in depth: correlate the plan with both the row's plan_id and organization_id.
-- Composite foreign keys already enforce the relationship; this removes tautological RLS predicates.
drop policy if exists planning_activity_progress_owner_insert on public.planning_activity_progress;
create policy planning_activity_progress_owner_insert on public.planning_activity_progress
 for insert to authenticated with check(
  private.planning_owner(organization_id)
  and reported_by=(select auth.uid())
  and exists(select 1 from public.planning_strategic_plans p
   where p.id=planning_activity_progress.plan_id
    and p.organization_id=planning_activity_progress.organization_id and p.status='approved')
 );
drop policy if exists planning_kpi_measurements_owner_insert on public.planning_kpi_measurements;
create policy planning_kpi_measurements_owner_insert on public.planning_kpi_measurements
 for insert to authenticated with check(
  private.planning_owner(organization_id)
  and measured_by=(select auth.uid())
  and exists(select 1 from public.planning_strategic_plans p
   where p.id=planning_kpi_measurements.plan_id
    and p.organization_id=planning_kpi_measurements.organization_id and p.status='approved')
 );
