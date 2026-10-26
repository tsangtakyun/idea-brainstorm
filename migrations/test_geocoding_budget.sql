-- Tests roll back their counters and do not issue any external API requests.
begin;
do $$
declare
  accepted integer := 0;
  i integer;
  test_user uuid := '00000000-0000-4000-8000-000000000001';
begin
  for i in 1..11 loop
    if public.consume_geocoding_budget(test_user) then accepted := accepted + 1; end if;
  end loop;
  if accepted <> 10 then raise exception 'Expected 10 of 11 requests accepted'; end if;
  if (select requests from public.geocoding_request_budgets
      where scope = 'global' and window_seconds = 60
      and window_start = date_trunc('minute', now())) <> 10
    then raise exception 'Rejected request consumed global budget'; end if;
  update public.geocoding_request_budgets set requests = 100
    where scope = 'user:' || test_user::text and window_seconds = 86400;
  if public.consume_geocoding_budget(test_user) then raise exception 'Daily quota bypass'; end if;
  if has_function_privilege('anon', 'public.consume_geocoding_budget(uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.consume_geocoding_budget(uuid)', 'execute')
    then raise exception 'Client may invoke budget function'; end if;
  if not has_function_privilege('service_role', 'public.consume_geocoding_budget(uuid)', 'execute')
    then raise exception 'Server cannot invoke budget function'; end if;
end $$;
select 'PASS: per-minute/day budgets, atomic rejection, client denial and server permission' as result;
rollback;
