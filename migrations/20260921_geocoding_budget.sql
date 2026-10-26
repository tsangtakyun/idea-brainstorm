-- New isolated table/function only; no existing data or policies modified.
-- Execute on the same Supabase project as idea-brainstorm after review.
begin;
create table if not exists public.geocoding_request_budgets (
  scope text not null,
  window_start timestamptz not null,
  window_seconds integer not null,
  requests integer not null check (requests >= 0),
  primary key (scope, window_start, window_seconds)
);
alter table public.geocoding_request_budgets enable row level security;
revoke all on public.geocoding_request_budgets from public, anon, authenticated;

create or replace function public.consume_geocoding_budget(request_user uuid)
returns boolean
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  minute_start timestamptz := date_trunc('minute', now());
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  item record;
  used integer;
begin
  if request_user is null then return false; end if;
  -- A single transaction lock makes checking and consuming all four budgets atomic.
  perform pg_advisory_xact_lock(726091, 1);
  delete from public.geocoding_request_budgets where window_start < now() - interval '2 days';
  for item in select * from (values
    ('user:' || request_user::text, minute_start, 60, 10),
    ('user:' || request_user::text, day_start, 86400, 100),
    ('global', minute_start, 60, 30),
    ('global', day_start, 86400, 500)
  ) as budgets(scope, start_at, seconds, ceiling)
  loop
    select requests into used from public.geocoding_request_budgets
      where scope = item.scope and window_start = item.start_at and window_seconds = item.seconds;
    if coalesce(used, 0) >= item.ceiling then return false; end if;
  end loop;
  insert into public.geocoding_request_budgets(scope, window_start, window_seconds, requests)
    values ('user:' || request_user::text, minute_start, 60, 1),
           ('user:' || request_user::text, day_start, 86400, 1),
           ('global', minute_start, 60, 1), ('global', day_start, 86400, 1)
    on conflict (scope, window_start, window_seconds)
    do update set requests = public.geocoding_request_budgets.requests + 1;
  return true;
end;
$$;
revoke all on function public.consume_geocoding_budget(uuid) from public, anon, authenticated;
grant execute on function public.consume_geocoding_budget(uuid) to service_role;
commit;
