
create table if not exists public.trade_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  worker_id     text not null,
  org_id        text not null,
  endpoint      text not null,
  subscription  jsonb not null,
  created_at    timestamptz default now(),
  constraint uq_push_worker_endpoint unique (worker_id, endpoint)
);

alter table public.trade_push_subscriptions enable row level security;

create policy "workers manage own push subscriptions"
  on public.trade_push_subscriptions
  for all
  using (auth.uid() = worker_id::uuid)
  with check (auth.uid() = worker_id::uuid);
;
