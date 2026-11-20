alter table public.planning_strategic_plans
 add column strategy_design jsonb not null default '{}'::jsonb
 check (jsonb_typeof(strategy_design)='object' and octet_length(strategy_design::text)<=250000);
