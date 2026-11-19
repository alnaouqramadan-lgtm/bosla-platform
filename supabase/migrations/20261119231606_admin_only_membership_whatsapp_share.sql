-- Admin-managed workshop membership. Set the sole admin in the private table
-- separately on each deployment; never commit personal account identifiers.
create table if not exists private.planning_platform_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 added_at timestamptz not null default now()
);
alter table private.planning_platform_admins enable row level security;
revoke all on private.planning_platform_admins from public, anon, authenticated;

create or replace function private.planning_is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.planning_platform_admins a where a.user_id=(select auth.uid()));
$$;
revoke all on function private.planning_is_platform_admin() from public, anon, authenticated;

create or replace function public.planning_is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select private.planning_is_platform_admin();
$$;
revoke all on function public.planning_is_platform_admin() from public, anon;
grant execute on function public.planning_is_platform_admin() to authenticated;

create or replace function public.planning_admin_add_participant(p_workshop uuid, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_participant uuid; v_display text; v_membership uuid;
begin
 if (select auth.uid()) is null or not private.planning_is_platform_admin() then
  raise exception 'إضافة المشاركين متاحة لمدير بوصلة المعتمد فقط';
 end if;
 if p_email is null or length(btrim(p_email))<3 or length(p_email)>254 then
  raise exception 'أدخل بريد المشارك الصحيح';
 end if;
 select w.organization_id into v_org from public.planning_workshops w
 where w.id=p_workshop and w.status='active';
 if v_org is null then raise exception 'الورشة غير موجودة أو مغلقة'; end if;
 select u.id, coalesce(nullif(btrim(p.full_name),''),split_part(u.email,'@',1))
 into v_participant,v_display
 from auth.users u left join public.planning_profiles p on p.id=u.id
 where lower(u.email)=lower(btrim(p_email)) and u.email_confirmed_at is not null
 limit 1;
 if v_participant is null then
  raise exception 'حساب المشارك غير موجود أو لم يُؤكد بعد؛ أنشئه أولاً في بوصلة';
 end if;
 insert into public.planning_participants
  (organization_id,workshop_id,user_id,display_name,workshop_role,is_recorder)
 values(v_org,p_workshop,v_participant,v_display,'participant',false)
 on conflict (workshop_id,user_id) do nothing
 returning id into v_membership;
 if v_membership is null then
  select id into v_membership from public.planning_participants
  where workshop_id=p_workshop and user_id=v_participant;
 end if;
 return v_membership;
end;
$$;
revoke all on function public.planning_admin_add_participant(uuid,text) from public, anon;
grant execute on function public.planning_admin_add_participant(uuid,text) to authenticated;

-- Previously issued reusable codes may no longer enroll accounts.
create or replace function public.planning_join_by_code(p_code text)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
 raise exception 'الانضمام برمز عام موقوف. اطلب من مدير بوصلة إضافتك إلى الورشة';
end;
$$;
create or replace function private.planning_join_by_code_checked(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
 raise exception 'الانضمام برمز عام موقوف';
end;
$$;
revoke all on function private.planning_join_by_code_checked(text) from public, anon, authenticated;
revoke all on function public.planning_join_by_code(text) from public, anon;
grant execute on function public.planning_join_by_code(text) to authenticated;