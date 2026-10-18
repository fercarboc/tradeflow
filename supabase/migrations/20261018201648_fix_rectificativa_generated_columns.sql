-- ============================================================
-- PH0-INVOICE-RECTIFY-ERROR-1 — Fix fn_crear_factura_rectificativa
-- iva_importe y total son columnas GENERATED ALWAYS AS STORED.
-- La función intentaba insertarlas explícitamente, causando:
--   "cannot insert a non-DEFAULT value into column iva_importe"
-- Corrección: eliminar ambas columnas del INSERT; PostgreSQL las
-- calcula automáticamente a partir de subtotal e iva_pct, produciendo
-- resultados matemáticamente idénticos.
-- Scope: solo el INSERT de la rectificativa. Sin cambios en esquema,
-- triggers, fn_emitir_factura ni funciones VeriFactu.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_crear_factura_rectificativa(
  p_original_invoice_id  uuid,
  p_org_id               uuid,
  p_tipo_factura_vf      text,
  p_motivo               text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role   text;
  v_orig       record;
  v_rect_id    uuid;
  v_numero_tmp text;
BEGIN
  v_jwt_role := auth.role();

  IF v_jwt_role = 'authenticated' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Token autenticado sin identidad.' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND owner_id = auth.uid()
      UNION ALL
      SELECT 1 FROM public.trade_org_members WHERE org_id = p_org_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Acceso no autorizado.' USING ERRCODE = '42501';
    END IF;
  ELSIF v_jwt_role = 'service_role' OR v_jwt_role IS NULL THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'No autorizado: rol "%".', COALESCE(v_jwt_role, 'unknown') USING ERRCODE = '42501';
  END IF;

  IF p_tipo_factura_vf NOT IN ('R1', 'R2', 'R3', 'R4') THEN
    RAISE EXCEPTION
      'tipo_factura_vf no válido: "%". Admitidos: R1 (error/art.80.1-2-6), R2 (concurso), R3 (incobrable), R4 (resto).',
      COALESCE(p_tipo_factura_vf, 'NULL')
      USING ERRCODE = 'P0001';
  END IF;

  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'El motivo de rectificación es obligatorio.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_org_id::text));

  SELECT * INTO v_orig
  FROM public.trade_invoices
  WHERE id = p_original_invoice_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura original no encontrada (id: %).', p_original_invoice_id USING ERRCODE = 'P0002';
  END IF;

  IF v_orig.estado = 'Borrador' THEN
    RAISE EXCEPTION 'No se puede rectificar una factura Borrador.' USING ERRCODE = 'P0001';
  END IF;

  IF v_orig.tipo_factura = 'rectificativa' THEN
    RAISE EXCEPTION 'No se puede rectificar una factura rectificativa.' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trade_invoices
    WHERE org_id = p_org_id AND rectifica_factura_id = p_original_invoice_id AND tipo_factura = 'rectificativa'
  ) THEN
    RAISE EXCEPTION 'Ya existe una rectificativa de esta factura.' USING ERRCODE = 'P0001';
  END IF;

  v_numero_tmp := 'BORRADOR-R-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.trade_invoices (
    org_id, client_id, tipo_factura, tipo_factura_vf, tipo_rectificativa,
    serie, estado, numero, concepto,
    subtotal, iva_pct,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
    rectifica_factura_id, motivo_rectificacion
  ) VALUES (
    p_org_id, v_orig.client_id, 'rectificativa', p_tipo_factura_vf, 'I',
    'R', 'Borrador', v_numero_tmp,
    'Rectificativa de ' || COALESCE(v_orig.numero, v_orig.id::text),
    -(v_orig.subtotal), v_orig.iva_pct,
    v_orig.razon_social_cliente, v_orig.nif_cliente, v_orig.direccion_cliente,
    v_orig.cp_cliente, v_orig.localidad_cliente, v_orig.provincia_cliente, v_orig.pais_cliente,
    p_original_invoice_id, p_motivo
  )
  RETURNING id INTO v_rect_id;

  INSERT INTO public.trade_invoice_lines (factura_id, descripcion, cantidad, precio_unitario, subtotal, tipo, orden)
  SELECT v_rect_id, descripcion, cantidad, -(precio_unitario), -(subtotal), tipo, orden
  FROM public.trade_invoice_lines
  WHERE factura_id = p_original_invoice_id
  ORDER BY orden;

  RETURN jsonb_build_object(
    'rectificativa_id',   v_rect_id,
    'original_id',        p_original_invoice_id,
    'original_numero',    v_orig.numero,
    'tipo_factura_vf',    p_tipo_factura_vf,
    'tipo_rectificativa', 'I',
    'motivo',             p_motivo,
    'numero_provisional', v_numero_tmp
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_crear_factura_rectificativa(uuid, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_crear_factura_rectificativa(uuid, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_crear_factura_rectificativa(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_crear_factura_rectificativa(uuid, uuid, text, text) TO service_role;
