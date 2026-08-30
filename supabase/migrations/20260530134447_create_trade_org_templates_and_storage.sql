
-- Plantillas personalizadas por organización
create table if not exists trade_org_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references trade_organizations(id) on delete cascade,
  tipo        text not null,
  nombre      text not null default '',
  contenido   text not null default '',
  updated_at  timestamptz not null default now(),
  unique(org_id, tipo)
);

alter table trade_org_templates enable row level security;

create policy "org members manage templates"
  on trade_org_templates for all
  using (org_id = any(_user_org_ids()))
  with check (org_id = any(_user_org_ids()));

-- Bucket para logos (si no existe)
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

-- Política de storage: solo el propietario puede subir/borrar
create policy "org logo upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'org-logos');

create policy "org logo update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'org-logos');

create policy "org logo public read"
  on storage.objects for select
  to public
  using (bucket_id = 'org-logos');
;
