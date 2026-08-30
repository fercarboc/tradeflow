
-- Genera hashes VeriFactu para todas las facturas emitidas/pagadas/pendientes
-- Encadenadas en orden cronológico por org_id + serie
-- Formato hash: SHA-256(CIF;NumFactura;FechaDD-MM-YYYY;TipoF;CuotaIVA;Total;HashAnterior) en HEX MAYÚSCULAS

DO $$
DECLARE
  r RECORD;
  prev_hash TEXT := '0';
  cur_cif TEXT;
  cur_org UUID := NULL;
  cur_serie TEXT := NULL;
  input_str TEXT;
  hash_hex TEXT;
  fecha_vf TEXT;
  tipo_vf TEXT;
BEGIN
  -- Procesar por org + serie en orden cronológico
  FOR r IN
    SELECT
      i.id,
      i.org_id,
      i.numero,
      i.serie,
      i.estado,
      i.iva_importe,
      i.total,
      COALESCE(i.fecha_emision::date, i.fecha::date, CURRENT_DATE) AS fecha_emision_date,
      o.nif AS org_nif
    FROM trade_invoices i
    JOIN trade_organizations o ON o.id = i.org_id
    WHERE i.estado NOT IN ('Borrador', 'Cancelada')
      AND i.verifactu_hash IS NULL
    ORDER BY i.org_id, COALESCE(i.serie, 'F'), COALESCE(i.fecha_emision::date, i.fecha::date), i.created_at
  LOOP
    -- Reiniciar cadena si cambia org o serie
    IF r.org_id != COALESCE(cur_org, r.org_id) OR r.serie != COALESCE(cur_serie, r.serie) THEN
      prev_hash := '0';
    END IF;
    cur_org   := r.org_id;
    cur_serie := COALESCE(r.serie, 'F');
    cur_cif   := COALESCE(r.org_nif, 'UNKNOWN');

    -- Fecha en formato DD-MM-YYYY
    fecha_vf := TO_CHAR(r.fecha_emision_date, 'DD-MM-YYYY');

    -- Tipo de factura VeriFactu: F1=normal, F2=mantenimiento (serie M)
    tipo_vf := CASE WHEN COALESCE(r.serie,'F') = 'M' THEN 'F2' ELSE 'F1' END;

    -- Construir input del hash
    input_str := cur_cif || ';' ||
                 r.numero || ';' ||
                 fecha_vf || ';' ||
                 tipo_vf || ';' ||
                 TO_CHAR(COALESCE(r.iva_importe, 0), 'FM999999990.00') || ';' ||
                 TO_CHAR(COALESCE(r.total, 0), 'FM999999990.00') || ';' ||
                 prev_hash;

    -- SHA-256 en hex mayúsculas
    hash_hex := UPPER(encode(digest(input_str, 'sha256'), 'hex'));

    -- Guardar hash en la factura
    UPDATE trade_invoices
    SET verifactu_hash          = hash_hex,
        verifactu_hash_anterior = CASE WHEN prev_hash = '0' THEN NULL ELSE prev_hash END
    WHERE id = r.id;

    -- Actualizar hash anterior para la siguiente factura
    prev_hash := hash_hex;
  END LOOP;
END;
$$;
;
