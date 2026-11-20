-- BOSLA AI: independent planning-team permissions and two-step plan review.
-- Does not alter workshop participant admission or ENJAZ AI.
alter table public.planning_strategic_plans
 drop constraint if exists planning_strategic_plans_status_check;
alter table public.planning_strategic_plans
 add constraint planning_strategic_plans_status_check
 check (status in ('draft','in_review','reviewed','approved'));

create table public.planning_plan_members (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 plan_id uuid not null,
 user_id uuid not null references auth.users(id),
 member_email text not null,
 role text not null check(role in ('editor','reviewer','viewer')),
 assigned_by uuid not null references auth.users(id),
 assigned_at timestamptz not null default now(),
 constraint bosla_plan_members_plan_fk foreign key(plan_id,organization_id)
  references public.planning_strategic_plans(id,organization_id) on delete cascade,
 constraint bosla_plan_members_unique unique(plan_id,user_id)
);
create unique index bosla_one_reviewer_per_plan
 on public.planning_plan_members(plan_id) where role='reviewer';
create index bosla_plan_members_user_idx on public.planning_plan_members(user_id,plan_id);
alter table public.planning_plan_members enable row level security;
revoke all on public.planning_plan_members from public,anon,authenticated;
grant select on public.planning_plan_members to authenticated;
create policy bosla_members_owner_or_self on public.planning_plan_members for select to authenticated
 using(private.planning_owner(organization_id) or user_id=(select auth.uid()));

-- Membership lookup runs in a locked-down unexposed schema and always checks auth.uid().
create function private.planning_can_view_plan(p_plan uuid,p_org uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null and
 (private.planning_owner(p_org) or exists(
   select 1 from public.planning_plan_members m
   where m.plan_id=p_plan and m.organization_id=p_org
     and m.user_id=(select auth.uid())
 ))
$$;
create function private.planning_can_edit_plan(p_plan uuid,p_org uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null and
 (private.planning_owner(p_org) or exists(
   select 1 from public.planning_plan_members m
   where m.plan_id=p_plan and m.organization_id=p_org
     and m.user_id=(select auth.uid()) and m.role='editor'
 ))
$$;
revoke all on function private.planning_can_view_plan(uuid,uuid),
 private.planning_can_edit_plan(uuid,uuid) from public,anon;
grant execute on function private.planning_can_view_plan(uuid,uuid),
 private.planning_can_edit_plan(uuid,uuid) to authenticated;

create table public.planning_plan_review_history (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 plan_id uuid not null,
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('submitted','approved','returned','reopened')),
 note text not null default '',
 created_at timestamptz not null default now(),
 constraint bosla_review_history_plan_fk foreign key(plan_id,organization_id)
  references public.planning_strategic_plans(id,organization_id) on delete restrict
);
create index bosla_review_history_plan_idx on public.planning_plan_review_history(plan_id,created_at);
alter table public.planning_plan_review_history enable row level security;
revoke all on public.planning_plan_review_history from public,anon,authenticated;
grant select on public.planning_plan_review_history to authenticated;
create policy bosla_review_history_read on public.planning_plan_review_history for select to authenticated
 using(private.planning_can_view_plan(plan_id,organization_id));

-- Replace owner-only plan policies with plan-specific reads and draft edits.
drop policy if exists bosla_plans_read on public.planning_strategic_plans;
create policy bosla_plans_read on public.planning_strategic_plans for select to authenticated
 using(private.planning_can_view_plan(id,organization_id));
drop policy if exists bosla_plans_update on public.planning_strategic_plans;
create policy bosla_plans_update on public.planning_strategic_plans for update to authenticated
 using(status='draft' and private.planning_can_edit_plan(id,organization_id))
 with check(status='draft' and private.planning_can_edit_plan(id,organization_id));

do $body$
declare tbl text;
begin
 foreach tbl in array array[
  'planning_strategic_goals','planning_operational_activities','planning_performance_indicators'
 ] loop
  execute format('drop policy if exists bosla_child_read on public.%I',tbl);
  execute format('drop policy if exists bosla_child_insert on public.%I',tbl);
  execute format('drop policy if exists bosla_child_update on public.%I',tbl);
  execute format('drop policy if exists bosla_child_delete on public.%I',tbl);
  execute format('create policy bosla_child_read on public.%I for select to authenticated using (private.planning_can_view_plan(plan_id,organization_id))',tbl);
  execute format('create policy bosla_child_insert on public.%I for insert to authenticated with check (private.planning_can_edit_plan(plan_id,organization_id) and exists(select 1 from public.planning_strategic_plans p where p.id=plan_id and p.organization_id=organization_id and p.status=''draft''))',tbl);
  execute format('create policy bosla_child_update on public.%I for update to authenticated using (private.planning_can_edit_plan(plan_id,organization_id) and exists(select 1 from public.planning_strategic_plans p where p.id=plan_id and p.organization_id=organization_id and p.status=''draft'')) with check (private.planning_can_edit_plan(plan_id,organization_id) and exists(select 1 from public.planning_strategic_plans p where p.id=plan_id and p.organization_id=organization_id and p.status=''draft''))',tbl);
  execute format('create policy bosla_child_delete on public.%I for delete to authenticated using (private.planning_can_edit_plan(plan_id,organization_id) and exists(select 1 from public.planning_strategic_plans p where p.id=plan_id and p.organization_id=organization_id and p.status=''draft''))',tbl);
 end loop;
end $body$;

drop policy if exists planning_plan_revisions_owner_read on public.planning_plan_revisions;
create policy planning_plan_revisions_team_read on public.planning_plan_revisions for select to authenticated
 using(private.planning_can_view_plan(plan_id,organization_id));
drop policy if exists planning_activity_progress_owner_read on public.planning_activity_progress;
create policy planning_activity_progress_team_read on public.planning_activity_progress for select to authenticated
 using(private.planning_can_view_plan(plan_id,organization_id));
drop policy if exists planning_activity_progress_owner_insert on public.planning_activity_progress;
create policy planning_activity_progress_team_insert on public.planning_activity_progress for insert to authenticated
 with check(private.planning_can_edit_plan(plan_id,organization_id)
  and reported_by=(select auth.uid())
  and exists(select 1 from public.planning_strategic_plans p where p.id=plan_id and p.organization_id=organization_id and p.status='approved'));
drop policy if exists planning_kpi_measurements_owner_read on public.planning_kpi_measurements;
create policy planning_kpi_measurements_team_read on public.planning_kpi_measurements for select to authenticated
 using(private.planning_can_view_plan(plan_id,organization_id));
drop policy if exists planning_kpi_measurements_owner_insert on public.planning_kpi_measurements;
create policy planning_kpi_measurements_team_insert on public.planning_kpi_measurements for insert to authenticated
 with check(private.planning_can_edit_plan(plan_id,organization_id)
  and measured_by=(select auth.uid())
  and exists(select 1 from public.planning_strategic_plans p where p.id=plan_id and p.organization_id=organization_id and p.status='approved'));

-- Only an owner can assign an already registered account; email lookups never
-- reveal the auth.users directory through the client Data API.
create function private.planning_assign_plan_member(p_plan uuid,p_email text,p_role text)
returns public.planning_plan_members language plpgsql security definer set search_path=''
as $$
declare p public.planning_strategic_plans; target_user auth.users; result public.planning_plan_members;
begin
 if (select auth.uid()) is null then raise exception 'سجل الدخول أولاً'; end if;
 select * into p from public.planning_strategic_plans where id=p_plan for update;
 if not found or not private.planning_owner(p.organization_id) then
  raise exception 'إدارة فريق التخطيط متاحة لمالك المؤسسة فقط';
 end if;
 if p.status<>'draft' then raise exception 'يمكن تغيير الفريق في حالة المسودة فقط'; end if;
 if p_role not in ('editor','reviewer','viewer') or p_role is null then
  raise exception 'الدور غير صالح';
 end if;
 select * into target_user from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
 if not found then raise exception 'يجب تسجيل حساب المستخدم في بوصلة أولاً'; end if;
 if target_user.id=(select auth.uid()) then
  raise exception 'مالك المؤسسة لا يحتاج إلى عضوية في فريق خطته';
 end if;
 insert into public.planning_plan_members(organization_id,plan_id,user_id,member_email,role,assigned_by)
 values(p.organization_id,p.id,target_user.id,target_user.email,p_role,(select auth.uid()))
 on conflict(plan_id,user_id) do update
  set member_email=excluded.member_email,role=excluded.role,
      assigned_by=excluded.assigned_by,assigned_at=now()
 returning * into result;
 return result;
end $$;

create function private.planning_remove_plan_member(p_plan uuid,p_user uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare p public.planning_strategic_plans;
begin
 if (select auth.uid()) is null then raise exception 'سجل الدخول أولاً'; end if;
 select * into p from public.planning_strategic_plans where id=p_plan for update;
 if not found or not private.planning_owner(p.organization_id) or p.status<>'draft' then
  raise exception 'لا يمكن تغيير أعضاء الفريق في هذه الحالة';
 end if;
 delete from public.planning_plan_members where plan_id=p.id and user_id=p_user;
end $$;

create function private.planning_send_plan_for_review(p_plan uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare p public.planning_strategic_plans;
begin
 if (select auth.uid()) is null then raise exception 'سجل الدخول أولاً'; end if;
 select * into p from public.planning_strategic_plans where id=p_plan for update;
 if not found or not private.planning_can_edit_plan(p.id,p.organization_id) or p.status<>'draft' then
  raise exception 'لا تملك صلاحية إرسال هذه الخطة للمراجعة';
 end if;
 if not exists(select 1 from public.planning_plan_members where plan_id=p.id and role='reviewer') then
  raise exception 'عيّن مراجعًا مستقلًا أولاً';
 end if;
 if char_length(btrim(p.vision))<3 or char_length(btrim(p.mission))<3 then
  raise exception 'أكمل الرؤية والرسالة قبل المراجعة';
 end if;
 update public.planning_strategic_plans set status='in_review' where id=p.id;
 insert into public.planning_plan_review_history(organization_id,plan_id,actor_id,action)
 values(p.organization_id,p.id,(select auth.uid()),'submitted');
end $$;

create function private.planning_review_plan(p_plan uuid,p_decision text,p_note text)
returns void language plpgsql security definer set search_path=''
as $$
declare p public.planning_strategic_plans;
begin
 if (select auth.uid()) is null then raise exception 'سجل الدخول أولاً'; end if;
 select * into p from public.planning_strategic_plans where id=p_plan for update;
 if not found or p.status<>'in_review' then
  raise exception 'الخطة ليست بانتظار المراجعة';
 end if;
 if not exists(select 1 from public.planning_plan_members m
    where m.plan_id=p.id and m.organization_id=p.organization_id
      and m.user_id=(select auth.uid()) and m.role='reviewer') then
  raise exception 'قرار المراجعة متاح للمراجع المكلف وحده';
 end if;
 if p_decision not in ('approve','return') or p_decision is null then
  raise exception 'قرار المراجعة غير صالح';
 end if;
 if p_decision='return' and char_length(btrim(coalesce(p_note,'')))<5 then
  raise exception 'أدخل سبب الإعادة للتعديل (خمسة أحرف على الأقل)';
 end if;
 update public.planning_strategic_plans
  set status=case when p_decision='approve' then 'reviewed' else 'draft' end
  where id=p.id;
 insert into public.planning_plan_review_history(organization_id,plan_id,actor_id,action,note)
 values(p.organization_id,p.id,(select auth.uid()),
  case when p_decision='approve' then 'approved' else 'returned' end,coalesce(p_note,''));
end $$;

create function private.planning_reopen_plan(p_plan uuid,p_note text)
returns void language plpgsql security definer set search_path=''
as $$
declare p public.planning_strategic_plans;
begin
 if (select auth.uid()) is null then raise exception 'سجل الدخول أولاً'; end if;
 select * into p from public.planning_strategic_plans where id=p_plan for update;
 if not found or not private.planning_owner(p.organization_id)
   or p.status not in ('in_review','reviewed') then
  raise exception 'لا يمكن إعادة هذه الخطة إلى المسودة';
 end if;
 update public.planning_strategic_plans set status='draft' where id=p.id;
 insert into public.planning_plan_review_history(organization_id,plan_id,actor_id,action,note)
 values(p.organization_id,p.id,(select auth.uid()),'reopened',coalesce(p_note,''));
end $$;

-- Final publication stays with the institution owner, and a configured
-- reviewer must explicitly approve before the immutable baseline is published.
create or replace function private.planning_publish_plan(p_plan uuid)
returns public.planning_plan_revisions language plpgsql security definer set search_path=''
as $$
declare p public.planning_strategic_plans; approved public.planning_plan_revisions; content jsonb; has_reviewer boolean;
begin
 if (select auth.uid()) is null then raise exception 'يجب تسجيل الدخول لاعتماد الخطة'; end if;
 select * into p from public.planning_strategic_plans where id=p_plan for update;
 if not found or not private.planning_owner(p.organization_id) then
  raise exception 'اعتماد الخطة النهائي متاح لمالك المؤسسة فقط';
 end if;
 if p.status='approved' then raise exception 'الخطة معتمدة بالفعل'; end if;
 select exists(select 1 from public.planning_plan_members
  where plan_id=p.id and role='reviewer') into has_reviewer;
 if (has_reviewer and p.status<>'reviewed') or
    (not has_reviewer and p.status<>'draft') then
  raise exception 'أكمل مرحلة مراجعة الخطة أولاً';
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
           where k.plan_id=p.id and (k.target is null or length(btrim(k.verification_source))=0)) then
  raise exception 'حدد المستهدف ومصدر التحقق لجميع مؤشرات الأداء';
 end if;
 update public.planning_strategic_plans set status='approved' where id=p.id returning * into p;
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
 values(p.organization_id,p.id,1,(select auth.uid()),content) returning * into approved;
 return approved;
end $$;

-- Public API wrappers run as invoker, while the private functions enforce
-- authentication, organization ownership, role, status and transaction locks.
create function public.planning_assign_plan_member(p_plan uuid,p_email text,p_role text)
returns public.planning_plan_members language sql security invoker set search_path=''
as $$ select private.planning_assign_plan_member(p_plan,p_email,p_role) $$;
create function public.planning_remove_plan_member(p_plan uuid,p_user uuid)
returns void language sql security invoker set search_path=''
as $$ select private.planning_remove_plan_member(p_plan,p_user) $$;
create function public.planning_send_plan_for_review(p_plan uuid)
returns void language sql security invoker set search_path=''
as $$ select private.planning_send_plan_for_review(p_plan) $$;
create function public.planning_review_plan(p_plan uuid,p_decision text,p_note text)
returns void language sql security invoker set search_path=''
as $$ select private.planning_review_plan(p_plan,p_decision,p_note) $$;
create function public.planning_reopen_plan(p_plan uuid,p_note text)
returns void language sql security invoker set search_path=''
as $$ select private.planning_reopen_plan(p_plan,p_note) $$;

revoke all on function private.planning_assign_plan_member(uuid,text,text),
 private.planning_remove_plan_member(uuid,uuid),private.planning_send_plan_for_review(uuid),
 private.planning_review_plan(uuid,text,text),private.planning_reopen_plan(uuid,text)
 from public,anon;
grant execute on function private.planning_assign_plan_member(uuid,text,text),
 private.planning_remove_plan_member(uuid,uuid),private.planning_send_plan_for_review(uuid),
 private.planning_review_plan(uuid,text,text),private.planning_reopen_plan(uuid,text)
 to authenticated;
revoke all on function public.planning_assign_plan_member(uuid,text,text),
 public.planning_remove_plan_member(uuid,uuid),public.planning_send_plan_for_review(uuid),
 public.planning_review_plan(uuid,text,text),public.planning_reopen_plan(uuid,text)
 from public,anon;
grant execute on function public.planning_assign_plan_member(uuid,text,text),
 public.planning_remove_plan_member(uuid,uuid),public.planning_send_plan_for_review(uuid),
 public.planning_review_plan(uuid,text,text),public.planning_reopen_plan(uuid,text)
 to authenticated;