
-- ══════════════════════════════════════════════════════════════════════════════
-- TX-FLEET-2A-STORAGE-GATE — Validación de storage_path + políticas vehicle-aware
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Corrige dos debilidades de seguridad en TX-FLEET-2A:
--
-- 1. CHECK CONSTRAINT en trade_vehicle_docs.storage_path
--    Garantiza a nivel de DB que el path sigue el patrón {org_id}/{vehicle_id}/{algo}
--    y que org_id/vehicle_id del path coinciden con los de la fila.
--    Sin este constraint, un INSERT directo podría referenciar el Storage de
--    otra organización sin que las políticas de tabla lo detectasen.
--
-- 2. Políticas Storage reforzadas en vehicle-docs
--    · INSERT: añade validación vehicle_id (seg. 2 del path) contra trade_vehicles.
--      Impide subir archivos a rutas de vehículos que no pertenecen a la org del usuario.
--    · SELECT/UPDATE/DELETE: siguen siendo solo org_id (las URLs firmadas ya
--      solo se generan para docs RLS-autorizados; añadir vehicle check en SELECT
--      podría bloquear consultas de vehículos desactivados con docs históricos).
--
-- INVARIANTES:
--   · Los documentos existentes no se modifican.
--   · Si un storage_path previo no cumple el formato, el ALTER fallará con un
--     mensaje explícito; revisar manualmente antes de aplicar.
--   · Los módulos de Servicios, Partes, Conductores, Rutas y Odómetro no se tocan.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. CHECK CONSTRAINT: storage_path scoped a (org_id, vehicle_id) ──────────
--
-- Format: {org_id}/{vehicle_id}/{filename_no_empty}
-- split_part(path, '/', N) devuelve '' si el segmento no existe.

ALTER TABLE public.trade_vehicle_docs
  ADD CONSTRAINT tvd_storage_path_scoped CHECK (
    storage_path IS NULL
    OR (
      split_part(storage_path, '/', 1) = org_id::text
      AND split_part(storage_path, '/', 2) = vehicle_id::text
      AND char_length(split_part(storage_path, '/', 3)) > 0
    )
  );

-- ── 2. Políticas Storage — INSERT con validación de vehicle_id ────────────────
--
-- Sustituye la política INSERT previa (solo org_id) por una que además verifica
-- que el segundo segmento del path corresponde a un vehículo activo de la org.

DROP POLICY IF EXISTS "vehicle_docs_storage_insert" ON storage.objects;

CREATE POLICY "vehicle_docs_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-docs'
  -- Org: el usuario debe ser owner o miembro activo
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.trade_organizations WHERE owner_id = auth.uid()
    )
    OR (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.trade_org_members
      WHERE user_id = auth.uid() AND rol IN ('owner', 'admin') AND activo = true
    )
  )
  -- Vehículo: el segundo segmento debe ser un vehículo que pertenece a esa org
  AND EXISTS (
    SELECT 1
      FROM public.trade_vehicles v
     WHERE v.id::text       = (storage.foldername(name))[2]
       AND v.org_id::text   = (storage.foldername(name))[1]
       AND v.activo         = true
  )
);
