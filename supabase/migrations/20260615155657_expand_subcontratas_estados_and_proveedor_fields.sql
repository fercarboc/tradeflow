
-- 1. Ampliar el CHECK constraint de estado en trade_subcontratas
ALTER TABLE trade_subcontratas
  DROP CONSTRAINT IF EXISTS trade_subcontratas_estado_check;

ALTER TABLE trade_subcontratas
  ADD CONSTRAINT trade_subcontratas_estado_check
  CHECK (estado IN (
    'pendiente', 'solicitado', 'presupuesto_recibido', 'añadido_presupuesto',
    'pendiente_cliente', 'en_curso', 'completado', 'factura_recibida', 'pagado', 'cancelado'
  ));

-- 2. Añadir campos ampliados a trade_subcontractors
ALTER TABLE trade_subcontractors
  ADD COLUMN IF NOT EXISTS direccion_fiscal    TEXT,
  ADD COLUMN IF NOT EXISTS direccion_trabajo   TEXT,
  ADD COLUMN IF NOT EXISTS persona_contacto    TEXT,
  ADD COLUMN IF NOT EXISTS horarios            TEXT,
  ADD COLUMN IF NOT EXISTS cobertura           TEXT,
  ADD COLUMN IF NOT EXISTS valoracion          SMALLINT DEFAULT 5 CHECK (valoracion BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS estado_proveedor    TEXT DEFAULT 'activo'
    CHECK (estado_proveedor IN ('activo', 'pendiente', 'bloqueado'));
;
