
-- ══════════════════════════════════════════════════════════════════════
-- SPRINT 1 — Módulo Contratos de Mantenimiento — Tablas + RLS
-- ══════════════════════════════════════════════════════════════════════

-- ── Catálogos globales (lectura para todos los autenticados) ──────────

CREATE TABLE trade_maintenance_oficios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text UNIQUE NOT NULL,
  nombre      text NOT NULL,
  descripcion text,
  icono       text,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE trade_maintenance_sla (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nivel                 text UNIQUE NOT NULL,
  nombre                text NOT NULL,
  tiempo_respuesta_min  int NOT NULL,
  tiempo_resolucion_min int NOT NULL,
  descripcion           text,
  color                 text,
  activo                boolean NOT NULL DEFAULT true
);

CREATE TABLE trade_maintenance_sectores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text UNIQUE NOT NULL,
  nombre      text NOT NULL,
  descripcion text,
  activo      boolean NOT NULL DEFAULT true
);

CREATE TABLE trade_maintenance_recargos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text UNIQUE NOT NULL,
  nombre      text NOT NULL,
  tipo        text NOT NULL,
  porcentaje  int NOT NULL,
  descripcion text,
  activo      boolean NOT NULL DEFAULT true
);

CREATE TABLE trade_maintenance_plantillas (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                 text UNIQUE NOT NULL,
  nombre                 text NOT NULL,
  oficio_id              uuid NOT NULL REFERENCES trade_maintenance_oficios(id),
  sector_id              uuid NOT NULL REFERENCES trade_maintenance_sectores(id),
  sla_nivel              text NOT NULL,
  descripcion            text,
  precio_min             numeric(10,2),
  precio_max             numeric(10,2),
  cuota_mensual_base     numeric(10,2),
  incluye_preventivos    boolean NOT NULL DEFAULT true,
  incluye_guardia        boolean NOT NULL DEFAULT false,
  num_visitas_preventivo int DEFAULT 1,
  frecuencia_preventivo  text DEFAULT 'mensual',
  materiales_incluidos   boolean NOT NULL DEFAULT false,
  penalizacion_sla_pct   int DEFAULT 0,
  variables              text[] DEFAULT '{}',
  clausulas_adicionales  text,
  activo                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz DEFAULT now()
);

-- ── Tablas por organización ───────────────────────────────────────────

CREATE TABLE trade_maintenance_presupuestos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  client_id             uuid REFERENCES trade_clients(id) ON DELETE SET NULL,
  plantilla_id          uuid REFERENCES trade_maintenance_plantillas(id),
  numero                text,
  estado                text NOT NULL DEFAULT 'borrador',
  oficio                text NOT NULL,
  sector                text,
  nombre_cliente        text,
  direccion_instalacion text,
  descripcion_servicios text,
  cuota_mensual         numeric(10,2),
  cuota_anual           numeric(10,2),
  cuota_trimestral      numeric(10,2),
  tipo_facturacion      text DEFAULT 'mensual',
  iva_pct               int DEFAULT 21,
  sla_nivel             text,
  tiempo_respuesta_h    int,
  incluye_preventivos   boolean DEFAULT true,
  num_visitas_preventivo int DEFAULT 1,
  incluye_guardia       boolean DEFAULT false,
  materiales_incluidos  boolean DEFAULT false,
  texto_libre           text,
  ia_json               jsonb,
  ia_prompt_usado       text,
  notas                 text,
  fecha                 date DEFAULT CURRENT_DATE,
  fecha_enviado         date,
  fecha_aceptado        date,
  fecha_vencimiento     date,
  generado_por_ia       boolean DEFAULT false,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE trade_maintenance_contratos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  client_id               uuid REFERENCES trade_clients(id) ON DELETE SET NULL,
  presupuesto_id          uuid REFERENCES trade_maintenance_presupuestos(id),
  plantilla_id            uuid REFERENCES trade_maintenance_plantillas(id),
  numero                  text,
  estado                  text NOT NULL DEFAULT 'activo',
  oficio                  text NOT NULL,
  sector                  text,
  nombre_cliente          text,
  direccion_instalacion   text,
  descripcion_servicios   text,
  cuota_mensual           numeric(10,2) NOT NULL,
  tipo_facturacion        text DEFAULT 'mensual',
  iva_pct                 int DEFAULT 21,
  sla_nivel               text,
  tiempo_respuesta_h      int,
  incluye_preventivos     boolean DEFAULT true,
  num_visitas_preventivo  int DEFAULT 1,
  frecuencia_preventivo   text DEFAULT 'mensual',
  incluye_guardia         boolean DEFAULT false,
  materiales_incluidos    boolean DEFAULT false,
  fecha_inicio            date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin               date,
  duracion_meses          int DEFAULT 12,
  renovacion_automatica   boolean DEFAULT true,
  preaviso_cancelacion_dias int DEFAULT 30,
  dia_facturacion         int DEFAULT 1,
  proxima_factura         date,
  ultima_factura          date,
  notas                   text,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE TABLE trade_maintenance_facturas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  contrato_id     uuid NOT NULL REFERENCES trade_maintenance_contratos(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES trade_clients(id),
  numero          text,
  estado          text NOT NULL DEFAULT 'pendiente',
  periodo_inicio  date NOT NULL,
  periodo_fin     date NOT NULL,
  cuota_base      numeric(10,2) NOT NULL,
  extras          numeric(10,2) DEFAULT 0,
  total_neto      numeric(10,2) NOT NULL,
  iva_pct         int DEFAULT 21,
  total_con_iva   numeric(10,2) NOT NULL,
  fecha_emision   date DEFAULT CURRENT_DATE,
  fecha_vencimiento date,
  fecha_pago      date,
  notas           text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE trade_maintenance_incidencias (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  contrato_id                 uuid REFERENCES trade_maintenance_contratos(id) ON DELETE SET NULL,
  client_id                   uuid REFERENCES trade_clients(id),
  titulo                      text NOT NULL,
  descripcion                 text,
  estado                      text NOT NULL DEFAULT 'abierta',
  prioridad                   text NOT NULL DEFAULT 'normal',
  fecha_reporte               timestamptz DEFAULT now(),
  fecha_asignacion            timestamptz,
  fecha_inicio_intervencion   timestamptz,
  fecha_resolucion            timestamptz,
  tiempo_respuesta_min        int,
  tiempo_resolucion_min       int,
  sla_cumplido                boolean,
  es_extra_contrato           boolean DEFAULT false,
  importe_extra               numeric(10,2),
  notas_resolucion            text,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

CREATE TABLE trade_maintenance_modelos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  nombre                text NOT NULL,
  descripcion           text,
  basado_en_plantilla_id uuid REFERENCES trade_maintenance_plantillas(id),
  datos_json            jsonb,
  veces_usado           int DEFAULT 0,
  activo                boolean DEFAULT true,
  created_at            timestamptz DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────────────

CREATE INDEX idx_mant_presup_org   ON trade_maintenance_presupuestos(org_id, created_at DESC);
CREATE INDEX idx_mant_presup_estado ON trade_maintenance_presupuestos(org_id, estado);
CREATE INDEX idx_mant_contrato_org  ON trade_maintenance_contratos(org_id, estado);
CREATE INDEX idx_mant_factura_org   ON trade_maintenance_facturas(org_id, estado);
CREATE INDEX idx_mant_incidencia_org ON trade_maintenance_incidencias(org_id, estado);

-- ── RLS: catálogos — solo lectura para autenticados ──────────────────

ALTER TABLE trade_maintenance_oficios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_maintenance_sla       ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_maintenance_sectores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_maintenance_recargos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_maintenance_plantillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_catalog_oficios"    ON trade_maintenance_oficios    FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_catalog_sla"        ON trade_maintenance_sla        FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_catalog_sectores"   ON trade_maintenance_sectores   FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_catalog_recargos"   ON trade_maintenance_recargos   FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_catalog_plantillas" ON trade_maintenance_plantillas  FOR SELECT TO authenticated USING (true);

-- ── RLS: tablas org — solo la propia organización ────────────────────

ALTER TABLE trade_maintenance_presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_maintenance_contratos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_maintenance_facturas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_maintenance_incidencias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_maintenance_modelos      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_presupuestos" ON trade_maintenance_presupuestos
  FOR ALL USING (org_id = ANY(_user_org_ids()));

CREATE POLICY "org_contratos" ON trade_maintenance_contratos
  FOR ALL USING (org_id = ANY(_user_org_ids()));

CREATE POLICY "org_facturas" ON trade_maintenance_facturas
  FOR ALL USING (org_id = ANY(_user_org_ids()));

CREATE POLICY "org_incidencias" ON trade_maintenance_incidencias
  FOR ALL USING (org_id = ANY(_user_org_ids()));

CREATE POLICY "org_modelos" ON trade_maintenance_modelos
  FOR ALL USING (org_id = ANY(_user_org_ids()));
;
