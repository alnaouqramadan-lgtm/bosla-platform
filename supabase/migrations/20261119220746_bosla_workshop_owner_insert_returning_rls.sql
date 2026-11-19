-- BOSLA AI: owner must be able to see a workshop in the same INSERT .. RETURNING
-- operation that creates it. Keep other users restricted to their membership.
-- Applied to the standalone Supabase project madvrkqtducoivnaaldm.
-- Do not apply to ENJAZ AI.
drop policy if exists planning_workshop_read on public.planning_workshops;
create policy planning_workshop_read
on public.planning_workshops
for select to authenticated
using (
  private.planning_owner(organization_id)
  or private.planning_member(id)
);
