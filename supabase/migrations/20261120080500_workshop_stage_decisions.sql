create table public.planning_stage_decisions (
 workshop_id uuid not null references public.planning_workshops(id) on delete cascade,
 stage smallint not null check (stage between 1 and 5),
 content text not null check (length(trim(content)) between 1 and 30000),
 decided_by uuid not null default auth.uid(),
 revision integer not null default 1,
 primary key(workshop_id,stage)
);
alter table public.planning_stage_decisions enable row level security;
revoke all on public.planning_stage_decisions from public,anon,authenticated;
grant select,insert(workshop_id,stage,content),update(content) on public.planning_stage_decisions to authenticated;
create policy manager_read on public.planning_stage_decisions for select to authenticated using(private.planning_manager(workshop_id));
create policy manager_insert on public.planning_stage_decisions for insert to authenticated with check(private.planning_manager(workshop_id) and exists(select 1 from public.planning_workshops w where w.id=workshop_id and w.status='active'));
create policy manager_update on public.planning_stage_decisions for update to authenticated using(private.planning_manager(workshop_id)) with check(private.planning_manager(workshop_id) and exists(select 1 from public.planning_workshops w where w.id=workshop_id and w.status='active'));
create function private.planning_stamp_decision() returns trigger language plpgsql set search_path='' as $$
begin
 new.decided_by:=auth.uid();
 new.revision:=old.revision+1;
 return new;
end
$$;
create trigger planning_stamp_decision before update on public.planning_stage_decisions for each row execute function private.planning_stamp_decision();
