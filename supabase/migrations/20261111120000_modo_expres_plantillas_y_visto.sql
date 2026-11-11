-- Modo Exprés de presupuestos (feature/modo-expres)
-- Cambios SOLO aditivos: una tabla nueva y una columna nueva. No se borra ni renombra nada.

-- 1. Plantillas de presupuesto por organización (visibles para el instalador)
create table if not exists trade_quote_templates (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references trade_organizations(id) on delete cascade,
  nombre        text not null,
  descripcion   text not null default '',
  partidas      jsonb not null default '[]'::jsonb,
  iva_pct       smallint,
  uso_count     integer not null default 0,
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_trade_quote_templates_org_uso
  on trade_quote_templates (org_id, uso_count desc, last_used_at desc nulls last);

alter table trade_quote_templates enable row level security;

drop policy if exists "org members manage quote templates" on trade_quote_templates;
create policy "org members manage quote templates"
  on trade_quote_templates for all
  using (org_id = any(_user_org_ids()))
  with check (org_id = any(_user_org_ids()));

-- 2. Seguimiento: cuándo abrió el cliente el enlace del presupuesto
alter table trade_quote_tokens add column if not exists viewed_at timestamptz;
