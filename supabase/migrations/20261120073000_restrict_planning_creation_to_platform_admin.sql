alter policy planning_org_owner_insert on public.planning_organizations
with check (owner_id = (select auth.uid()) and (select public.planning_is_platform_admin()));

alter policy planning_workshop_insert on public.planning_workshops
with check (created_by = (select auth.uid()) and private.planning_owner(organization_id) and (select public.planning_is_platform_admin()));
