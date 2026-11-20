import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const migration=read("../supabase/migrations/20261120200600_plan_collaboration_review.sql");
const team=read("../src/components/PlanTeamReview.tsx");
const detail=read("../src/app/plans/[id]/page.tsx");
const gov=read("../src/components/PlanGovernance.tsx");

test("review workflow has explicit states, separate reviewer and final owner",()=>{
 assert.match(migration,/check \(status in \('draft','in_review','reviewed','approved'\)\)/);
 assert.match(migration,/create unique index bosla_one_reviewer_per_plan/);
 assert.match(migration,/p\.status<>'in_review'/);
 assert.match(migration,/m\.role='reviewer'/);
 assert.match(migration,/not private\.planning_owner\(p\.organization_id\)/);
 assert.match(migration,/has_reviewer and p\.status<>'reviewed'/);
 assert.match(migration,/insert into public\.planning_plan_review_history/);
 assert.match(team,/planning_send_plan_for_review/);
 assert.match(team,/planning_review_plan/);
 assert.match(team,/planning_publish_plan/);
 assert.match(team,/planning_reopen_plan/);
});

test("permissions are tenant-bound, role-specific and cannot grant workshop admin",()=>{
 assert.match(migration,/foreign key\(plan_id,organization_id\)/);
 assert.match(migration,/alter table public\.planning_plan_members enable row level security/);
 assert.match(migration,/revoke all on public\.planning_plan_members from public,anon,authenticated/);
 assert.match(migration,/grant select on public\.planning_plan_members to authenticated/);
 assert.match(migration,/private\.planning_can_view_plan\(plan_id,organization_id\)/);
 assert.match(migration,/private\.planning_can_edit_plan\(plan_id,organization_id\)/);
 assert.match(migration,/m\.user_id=\(select auth\.uid\(\)\)/);
 assert.match(migration,/role='editor'/);
 assert.match(migration,/and p\.status=''draft''/);
 assert.doesNotMatch(migration,/service_role|raw_user_meta_data|grant (insert|update|delete) on public\.planning_plan_members to authenticated/i);
 assert.match(team,/لا يمنح ذلك صلاحية إدارة الورش أو إضافة مشاركين إليها/);
});

test("viewer and reviewer have no editing or monitoring write controls",()=>{
 assert.match(detail,/const canEdit=plan\?\.status==="draft"&&\(accessRole==="owner"\|\|accessRole==="editor"\)/);
 assert.match(detail,/role=\{accessRole\}/);
 assert.match(gov,/\(role==="owner"\|\|role==="editor"\)&&<div className="institutional-followup-grid"/);
 assert.match(gov,/\!\(role==="owner"\|\|role==="editor"\)/);
 assert.match(team,/role==="reviewer"&&/);
 assert.match(team,/isOwner&&!hasReviewer/);
});
