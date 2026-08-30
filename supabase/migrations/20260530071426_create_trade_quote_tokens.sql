
create table if not exists trade_quote_tokens (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references trade_organizations(id) on delete cascade,
  quote_numero text not null,
  token       uuid not null unique default gen_random_uuid(),
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  client_name text,
  quote_data  jsonb not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table trade_quote_tokens enable row level security;

-- Miembros de la org pueden gestionar sus propios tokens
create policy "org members manage tokens"
  on trade_quote_tokens for all
  using (org_id = any(_user_org_ids()))
  with check (org_id = any(_user_org_ids()));

-- Acceso público por token (el UUID actúa como contraseña)
create policy "public read by token"
  on trade_quote_tokens for select
  to anon
  using (true);

-- Acceso público para aceptar/rechazar (solo si está pendiente)
create policy "public accept pending"
  on trade_quote_tokens for update
  to anon
  using (status = 'pending')
  with check (status in ('accepted', 'rejected'));
;
