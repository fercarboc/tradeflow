
-- Tabla de contratos de mantenimiento por org + cliente
create table if not exists trade_contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references trade_organizations(id) on delete cascade,
  client_id uuid references trade_clients(id) on delete set null,
  mantenimiento_id uuid references trade_maintenance_presupuestos(id) on delete set null,
  referencia text not null,
  oficio text not null default 'fontaneria',
  estado text not null default 'borrador' check (estado in ('borrador','firmado')),
  variables jsonb not null default '{}',
  contenido_html text,
  pdf_url text,
  firmado_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table trade_contracts enable row level security;

create policy "org members manage contracts"
  on trade_contracts for all
  using (org_id = any(_user_org_ids()))
  with check (org_id = any(_user_org_ids()));

create index if not exists trade_contracts_org_id_idx on trade_contracts(org_id);
create index if not exists trade_contracts_client_id_idx on trade_contracts(client_id);
create index if not exists trade_contracts_mantenimiento_id_idx on trade_contracts(mantenimiento_id);
;
