
-- ── email_templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'general',
  asunto          TEXT NOT NULL,
  contenido_texto TEXT NOT NULL,
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_email_templates" ON email_templates; END $$;
CREATE POLICY "admin_email_templates" ON email_templates
  USING (auth.email() = 'fercarboc@gmail.com')
  WITH CHECK (auth.email() = 'fercarboc@gmail.com');

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── entity_email_history ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entity_email_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           UUID REFERENCES admin_corp_entities(id) ON DELETE SET NULL,
  template_id         UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  template_nombre     TEXT,
  subject             TEXT NOT NULL,
  body_html           TEXT,
  body_text           TEXT,
  to_email            TEXT NOT NULL,
  cc_email            TEXT,
  attachments         JSONB NOT NULL DEFAULT '[]',
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','sent','error','opened','clicked')),
  sent_at             TIMESTAMPTZ,
  sent_by             TEXT,
  provider_message_id TEXT,
  opened              BOOLEAN NOT NULL DEFAULT false,
  clicked             BOOLEAN NOT NULL DEFAULT false,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE entity_email_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_email_history" ON entity_email_history; END $$;
CREATE POLICY "admin_email_history" ON entity_email_history
  USING (auth.email() = 'fercarboc@gmail.com')
  WITH CHECK (auth.email() = 'fercarboc@gmail.com');

-- Índice para queries por entidad
CREATE INDEX IF NOT EXISTS idx_email_history_entity ON entity_email_history(entity_id);
CREATE INDEX IF NOT EXISTS idx_email_history_sent ON entity_email_history(sent_at DESC);

-- ── Plantillas iniciales ────────────────────────────────────────────────────
INSERT INTO email_templates (nombre, tipo, asunto, contenido_texto) VALUES
(
  'Presentación institucional',
  'presentacion',
  'TrabFlow | Propuesta de colaboración',
  'Buenos días {{contacto}},

Mi nombre es Fernando Carbonell, fundador de TrabFlow Technologies.

Hemos desarrollado una plataforma específica para empresas instaladoras que automatiza presupuestos, planificación, facturación, mantenimiento e integra IA y VeriFactu.

Creemos que puede aportar mucho valor a {{empresa}} y nos gustaría presentaros el proyecto.

Adjuntamos un dossier institucional de apenas unos minutos de lectura.

Si os parece interesante, estaremos encantados de realizar una demostración de la plataforma y valorar un posible programa piloto.

Muchas gracias por vuestro tiempo.

Fernando Carbonell'
),
(
  'Seguimiento',
  'seguimiento',
  'Seguimiento propuesta TrabFlow',
  'Buenos días {{contacto}},

Hace unos días os enviamos nuestro dossier institucional y queríamos confirmar que lo habéis recibido correctamente.

Quedamos a vuestra disposición para realizar una demostración online de la plataforma o resolver cualquier duda.

Muchas gracias.

Fernando Carbonell'
),
(
  'Novedades',
  'novedades',
  'Novedades TrabFlow',
  'Buenos días {{contacto}},

Nos gustaría compartir con vosotros algunas de las últimas novedades incorporadas a TrabFlow.

Hemos añadido nuevas funcionalidades que creemos pueden aportar aún más valor a las empresas instaladoras y a sus asociados.

Adjuntamos la información actualizada.

Muchas gracias.

Fernando Carbonell'
)
ON CONFLICT DO NOTHING;
;
