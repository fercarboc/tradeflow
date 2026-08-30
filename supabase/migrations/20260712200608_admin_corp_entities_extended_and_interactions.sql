
-- ── Ampliar admin_corp_entities ───────────────────────────────────────────
ALTER TABLE admin_corp_entities
  ADD COLUMN IF NOT EXISTS external_key      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS nombre_legal      TEXT,
  ADD COLUMN IF NOT EXISTS cif               TEXT,
  ADD COLUMN IF NOT EXISTS web               TEXT,
  ADD COLUMN IF NOT EXISTS email_general     TEXT,
  ADD COLUMN IF NOT EXISTS telefono_general  TEXT,
  ADD COLUMN IF NOT EXISTS cargo_contacto    TEXT,
  ADD COLUMN IF NOT EXISTS prioridad         TEXT NOT NULL DEFAULT 'media'
    CHECK (prioridad IN ('muy_alta', 'alta', 'media', 'baja')),
  ADD COLUMN IF NOT EXISTS encaje_tradeflow  TEXT,
  ADD COLUMN IF NOT EXISTS verificacion      TEXT NOT NULL DEFAULT 'Sin verificar',
  ADD COLUMN IF NOT EXISTS fuente_principal  TEXT,
  ADD COLUMN IF NOT EXISTS fuente_secundaria TEXT,
  ADD COLUMN IF NOT EXISTS fecha_verificacion DATE,
  ADD COLUMN IF NOT EXISTS direccion         TEXT,
  ADD COLUMN IF NOT EXISTS cp                TEXT,
  ADD COLUMN IF NOT EXISTS localidad         TEXT,
  ADD COLUMN IF NOT EXISTS provincia         TEXT,
  ADD COLUMN IF NOT EXISTS pais              TEXT DEFAULT 'España';

-- ── Tabla de interacciones / conversaciones ───────────────────────────────
CREATE TABLE IF NOT EXISTS admin_corp_interactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id  UUID NOT NULL REFERENCES admin_corp_entities(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL DEFAULT 'nota'
    CHECK (tipo IN ('email', 'llamada', 'reunion', 'whatsapp', 'documento_enviado', 'nota', 'otro')),
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  asunto     TEXT NOT NULL,
  cuerpo     TEXT,
  resultado  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corp_interactions_entity
  ON admin_corp_interactions (entity_id, fecha DESC);

ALTER TABLE admin_corp_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_corp_interactions" ON admin_corp_interactions
  FOR ALL USING (auth.email() = 'fercarboc@gmail.com');

-- ── Upsert 8 entidades iniciales ─────────────────────────────────────────
INSERT INTO admin_corp_entities (
  external_key, tipo, estado, nombre, nombre_legal, cif,
  web, email_general, telefono_general,
  direccion, cp, localidad, provincia, pais,
  contacto_nombre, cargo_contacto, contacto_email, contacto_tel,
  proxima_accion, prioridad, encaje_tradeflow,
  notas, fuente_principal, fuente_secundaria,
  fecha_verificacion, verificacion
) VALUES
(
  'ASOC-CONAIF', 'asociacion', 'potencial', 'CONAIF',
  'Confederación Nacional de Asociaciones de Empresas Instaladoras y Fluidos', NULL,
  'https://www.conaif.es/', 'comunicacion@conaif.es', '+34 914 681 003',
  'C/ Antracita, 7, 2ª planta, Nave 11', '28045', 'Madrid', 'Madrid', 'España',
  'José Cueto', 'Gabinete de Comunicación', 'comunicacion@conaif.es', '+34 914 681 003 ext. 208',
  'Solicitar reunión de presentación y colaboración', 'muy_alta',
  'Canal nacional de asociaciones y empresas instaladoras',
  'Contacto inicial recomendado a través de comunicación; confirmar responsable de alianzas o convenios.',
  'https://www.conaif.es/contacto-de-prensa/', 'https://www.conaif.es/contacta-con-conaif/',
  '2026-07-12', 'Parcial'
),
(
  'ASOC-FENIE', 'asociacion', 'potencial', 'FENIE',
  'Federación Nacional de Empresarios de Instalaciones Eléctricas y Telecomunicaciones de España', NULL,
  'https://fenie.es/', 'fenie@fenie.es', '+34 914 113 217',
  'C/ Príncipe de Vergara, 74, 3ª planta', '28006', 'Madrid', 'Madrid', 'España',
  NULL, NULL, 'fenie@fenie.es', '+34 914 113 217',
  'Solicitar contacto del área de convenios o innovación', 'muy_alta',
  'Federación nacional con red de asociaciones y empresas instaladoras',
  'La web indica 70 asociaciones y más de 15.000 empresas; validar cifra al contactar.',
  'https://fenie.es/contacto/', 'https://fenie.es/presentacion/',
  '2026-07-12', 'Verificado'
),
(
  'ASOC-CNI', 'asociacion', 'potencial', 'CNI Instaladores',
  'Confederación Nacional de Instaladores y Mantenedores', NULL,
  'https://www.cni-instaladores.com/', 'cni@cni-instaladores.com', '+34 914 112 410',
  'C/ Príncipe de Vergara, 74', '28006', 'Madrid', 'Madrid', 'España',
  'Blanca Gómez', 'Directora General', 'blanca.gomez@cni-instaladores.com', '+34 914 112 410',
  'Enviar presentación breve y solicitar reunión', 'muy_alta',
  'Representación de instaladores de climatización, fontanería, electricidad y mantenimiento',
  'Confirmar que Blanca Gómez sigue siendo la persona adecuada antes de contactar.',
  'https://www.cni-instaladores.com/contacto/',
  'https://www.area-eur.be/organisations/confederacion-nacional-de-instaladores-y-mantenedores',
  '2026-07-12', 'Parcial'
),
(
  'ASOC-AGREMIA', 'asociacion', 'potencial', 'AGREMIA',
  'Asociación de Empresas del Sector de las Instalaciones y la Energía', NULL,
  'https://agremia.com/', 'agremia@agremia.com', '+34 914 687 251',
  'C/ Antracita, 7, 2ª planta', '28045', 'Madrid', 'Madrid', 'España',
  'Ana Hermosilla', 'Departamento de Marketing', 'marketing@agremia.com', '+34 914 687 251 ext. 103',
  'Contactar con marketing para explorar convenio y difusión', 'muy_alta',
  'Acceso directo a instaladores de Madrid y capacidad formativa',
  'Contacto de marketing publicado en una página de convenio; confirmar vigencia.',
  'https://agremia.com/contacto-2/', 'https://agremia.com/convenio-habitissimo/',
  '2026-07-12', 'Parcial'
),
(
  'PART-SALTOKI', 'partner', 'potencial', 'Grupo Saltoki', 'Grupo Saltoki', NULL,
  'https://www.saltoki.com/', NULL, '900 115 511',
  NULL, NULL, NULL, NULL, 'España',
  NULL, NULL, NULL, '900 115 511',
  'Solicitar contacto de alianzas, marketing o transformación digital', 'alta',
  'Distribuidor profesional con más de 85 puntos de venta y acceso al instalador',
  'No se localizó email corporativo general fiable; usar formulario o teléfono y completar después.',
  'https://www.saltoki.com/', 'https://www.saltoki.com/quienes-somos',
  '2026-07-12', 'Parcial'
),
(
  'PART-SALVADOR-ESCODA', 'partner', 'potencial', 'Salvador Escoda', 'Salvador Escoda, S.A.', 'A08710006',
  'https://www.salvadorescoda.com/', 'info@salvadorescoda.com', '+34 934 462 780',
  'C/ Nàpols, 249, planta 1', '08013', 'Barcelona', 'Barcelona', 'España',
  NULL, NULL, 'info@salvadorescoda.com', '+34 934 462 780',
  'Solicitar contacto de marketing, dirección comercial o alianzas', 'alta',
  'Distribuidor de climatización, ventilación, calefacción y suministros para instaladores',
  'Datos legales y generales publicados en su web oficial.',
  'https://www.salvadorescoda.com/contacta/', 'https://www.salvadorescoda.com/aviso-legal/',
  '2026-07-12', 'Verificado'
),
(
  'PART-SONEPAR-ES', 'partner', 'potencial', 'Sonepar España', 'Sonepar España', NULL,
  'https://sonepar.es/', 'comunicacion@sonepar.es', NULL,
  'C/ Ramón y Cajal, 24', '28914', 'Leganés', 'Madrid', 'España',
  NULL, 'Comunicación', 'comunicacion@sonepar.es', NULL,
  'Solicitar derivación a innovación, marketing o desarrollo de negocio', 'alta',
  'Distribución eléctrica y soluciones para instaladores profesionales',
  'El correo y domicilio aparecen en una página corporativa/promocional; confirmar canal comercial.',
  'https://sonepar.es/contacto/', 'https://www.sonepar.es/philips/trueforce/index.php',
  '2026-07-12', 'Parcial'
),
(
  'PART-OBRAMAT', 'partner', 'potencial', 'OBRAMAT', 'Bricolaje Bricoman, S.L.U.', 'B84406289',
  'https://www.obramat.es/', NULL, NULL,
  'C/ Margarita Salas, 6', '28919', 'Leganés', 'Madrid', 'España',
  NULL, NULL, NULL, NULL,
  'Contactar por canal corporativo y pedir responsable de partnerships profesionales', 'alta',
  'Gran base de clientes profesionales de construcción y reforma',
  'Solo se han incluido datos societarios públicos; falta localizar contacto comercial específico.',
  'https://www.obramat.es/', 'https://empleo.obramat.es/privacy-policy',
  '2026-07-12', 'Parcial'
)
ON CONFLICT (external_key) DO UPDATE SET
  tipo              = EXCLUDED.tipo,
  estado            = EXCLUDED.estado,
  nombre            = EXCLUDED.nombre,
  nombre_legal      = EXCLUDED.nombre_legal,
  cif               = EXCLUDED.cif,
  web               = EXCLUDED.web,
  email_general     = EXCLUDED.email_general,
  telefono_general  = EXCLUDED.telefono_general,
  direccion         = EXCLUDED.direccion,
  cp                = EXCLUDED.cp,
  localidad         = EXCLUDED.localidad,
  provincia         = EXCLUDED.provincia,
  pais              = EXCLUDED.pais,
  contacto_nombre   = EXCLUDED.contacto_nombre,
  cargo_contacto    = EXCLUDED.cargo_contacto,
  contacto_email    = EXCLUDED.contacto_email,
  contacto_tel      = EXCLUDED.contacto_tel,
  proxima_accion    = EXCLUDED.proxima_accion,
  prioridad         = EXCLUDED.prioridad,
  encaje_tradeflow  = EXCLUDED.encaje_tradeflow,
  notas             = EXCLUDED.notas,
  fuente_principal  = EXCLUDED.fuente_principal,
  fuente_secundaria = EXCLUDED.fuente_secundaria,
  fecha_verificacion= EXCLUDED.fecha_verificacion,
  verificacion      = EXCLUDED.verificacion,
  updated_at        = NOW();
;
