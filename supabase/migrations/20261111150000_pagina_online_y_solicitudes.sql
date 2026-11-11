-- Mi página online + Solicitudes de presupuesto (feature/pagina-online)
-- Cambios SOLO aditivos: dos tablas nuevas. No se borra ni renombra nada.

-- 1. Página pública del instalador (trabflow.com/pro/{slug})
create table if not exists trade_public_pages (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null unique references trade_organizations(id) on delete cascade,
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  activa        boolean not null default false,
  nombre        text not null default '',
  oficio        text not null default '',
  whatsapp      text not null default '',
  acerca        text not null default '',
  acerca_on     boolean not null default true,
  servicios     text[] not null default '{}',
  servicios_on  boolean not null default true,
  cifras        jsonb not null default '[]'::jsonb,   -- [{valor, etiqueta}]
  cifras_on     boolean not null default false,
  preguntas     jsonb not null default '[]'::jsonb,   -- [{id, etiqueta, tipo: texto|opciones, opciones[], obligatoria}]
  portfolio     text[] not null default '{}',         -- URLs de imágenes
  portfolio_on  boolean not null default false,
  portada_url   text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table trade_public_pages enable row level security;

drop policy if exists "org members manage public page" on trade_public_pages;
create policy "org members manage public page"
  on trade_public_pages for all
  using (org_id = any(_user_org_ids()))
  with check (org_id = any(_user_org_ids()));

-- Lectura pública solo de páginas activas (el contenido es público por diseño)
drop policy if exists "public read active pages" on trade_public_pages;
create policy "public read active pages"
  on trade_public_pages for select
  to anon, authenticated
  using (activa);

-- 2. Solicitudes recibidas desde la página (las inserta solo la Edge Function trade-page-request)
create table if not exists trade_page_requests (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references trade_organizations(id) on delete cascade,
  page_id           uuid references trade_public_pages(id) on delete set null,
  nombre            text not null,
  telefono          text not null,
  respuestas        jsonb not null default '[]'::jsonb, -- [{pregunta, respuesta}]
  mensaje           text not null default '',
  estado            text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'convertido', 'rechazado')),
  quote_numero      text,
  consentimiento_at timestamptz not null,
  ip_hash           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_trade_page_requests_org_fecha on trade_page_requests (org_id, created_at desc);
create index if not exists idx_trade_page_requests_ip on trade_page_requests (ip_hash, created_at desc);

alter table trade_page_requests enable row level security;

drop policy if exists "org members read requests" on trade_page_requests;
create policy "org members read requests"
  on trade_page_requests for select
  using (org_id = any(_user_org_ids()));

drop policy if exists "org members update requests" on trade_page_requests;
create policy "org members update requests"
  on trade_page_requests for update
  using (org_id = any(_user_org_ids()))
  with check (org_id = any(_user_org_ids()));

drop policy if exists "org members delete requests" on trade_page_requests;
create policy "org members delete requests"
  on trade_page_requests for delete
  using (org_id = any(_user_org_ids()));
