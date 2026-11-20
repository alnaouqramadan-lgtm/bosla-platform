create function private.planning_admin_participant_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if exists(select 1 from private.planning_platform_admins where user_id=new.user_id) then
  if new.group_id is not null or new.is_recorder then
   raise exception 'مدير المنصة يدير الورشة ولا يُكلّف بعضوية مجموعة أو بتقريرها.' using errcode='23514';
  end if;
  new.workshop_role := 'facilitator';
 end if;
 return new;
end
$$;
revoke all on function private.planning_admin_participant_guard() from public;
create trigger planning_admin_participant_guard before insert or update on public.planning_participants
for each row execute function private.planning_admin_participant_guard();
update public.planning_participants p set group_id=null,is_recorder=false,workshop_role='facilitator'
from private.planning_platform_admins a where a.user_id=p.user_id and (p.group_id is not null or p.is_recorder or p.workshop_role<>'facilitator');

create function public.planning_workshop_admin_ids(p_workshop uuid) returns setof uuid
language sql stable security definer set search_path='' as $$
 select p.user_id from public.planning_participants p
 join private.planning_platform_admins a on a.user_id=p.user_id
 where p.workshop_id=p_workshop and private.planning_manager(p_workshop)
$$;
revoke all on function public.planning_workshop_admin_ids(uuid) from public, anon;
grant execute on function public.planning_workshop_admin_ids(uuid) to authenticated;
