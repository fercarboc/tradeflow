-- Sprint Guest-1 · Migración 10 — resolve_effective_offering_price corregida (C2)
-- Evalúa TODOS los candidatos válidos, selecciona MIN. Sin acumulación.
-- Ejemplo: PVD=100, condición=90, promo=80 → resultado=80, tipo=promo_profesional

DROP FUNCTION IF EXISTS public.resolve_effective_offering_price(uuid, text, uuid, numeric, timestamptz);

CREATE FUNCTION public.resolve_effective_offering_price(
  p_offering_id     uuid,
  p_buyer_mode      text,
  p_org_id          uuid DEFAULT NULL,
  p_quantity        numeric DEFAULT 1,
  p_at              timestamptz DEFAULT now()
) RETURNS TABLE (
  precio_neto         numeric,
  precio_con_iva      numeric,
  tax_rate            numeric,
  currency            char(3),
  precio_tipo         text,
  regla_aplicada      text,
  promotion_id        uuid,
  condition_id        uuid,
  condition_price_id  uuid,
  resolution_version  int,
  valid_until         timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_o            RECORD;
  v_actor        uuid;
  v_pvd          numeric;
  v_best_precio  numeric;
  v_best_tipo    text;
  v_best_regla   text;
  v_best_prom_id uuid;
  v_best_cond_id uuid;
  v_best_cpri_id uuid;
  v_best_until   timestamptz;
BEGIN
  IF p_buyer_mode NOT IN ('public', 'professional') THEN
    RAISE EXCEPTION 'INVALID_BUYER_MODE: %', p_buyer_mode;
  END IF;

  SELECT o.precio_profesional_neto, o.precio_publico_neto,
         o.tax_rate, o.currency,
         o.venta_publica_habilitada, o.venta_profesional_habilitada
  INTO v_o
  FROM public.trade_marketplace_supplier_offerings o
  WHERE o.id = p_offering_id AND o.activa = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OFFERING_NOT_FOUND: %', p_offering_id;
  END IF;

  -- ── MODO PÚBLICO ──────────────────────────────────────────────────────────
  IF p_buyer_mode = 'public' THEN
    IF NOT v_o.venta_publica_habilitada OR v_o.precio_publico_neto IS NULL THEN
      RAISE EXCEPTION 'PUBLIC_SALE_NOT_AVAILABLE: offering %', p_offering_id;
    END IF;

    v_best_precio  := v_o.precio_publico_neto;
    v_best_tipo    := 'pvp';
    v_best_regla   := 'PVP_base';
    v_best_prom_id := NULL;
    v_best_until   := NULL;

    SELECT p.id, p.precio_promo_neto, p.valid_until
    INTO v_best_prom_id, v_best_precio, v_best_until
    FROM public.trade_marketplace_offering_promos p
    WHERE p.offering_id = p_offering_id
      AND p.activa = true
      AND p.audience IN ('public', 'both')
      AND p.valid_from <= p_at AND p.valid_until > p_at
      AND p.precio_promo_neto < v_o.precio_publico_neto
    ORDER BY p.precio_promo_neto ASC
    LIMIT 1;

    IF FOUND THEN
      v_best_tipo  := 'promo_publica';
      v_best_regla := 'promo_activa_mejora_pvp';
    ELSE
      v_best_precio  := v_o.precio_publico_neto;
      v_best_tipo    := 'pvp';
      v_best_regla   := 'PVP_base';
      v_best_prom_id := NULL;
      v_best_until   := NULL;
    END IF;

  -- ── MODO PROFESIONAL ──────────────────────────────────────────────────────
  ELSE
    IF NOT v_o.venta_profesional_habilitada OR v_o.precio_profesional_neto IS NULL THEN
      RAISE EXCEPTION 'PROFESSIONAL_SALE_NOT_AVAILABLE: offering %', p_offering_id;
    END IF;

    v_pvd := v_o.precio_profesional_neto;
    v_best_precio  := v_pvd;
    v_best_tipo    := 'pvd';
    v_best_regla   := 'PVD_base';
    v_best_prom_id := NULL;
    v_best_cond_id := NULL;
    v_best_cpri_id := NULL;
    v_best_until   := NULL;

    -- Obtener actor vía offering → catalog → actor
    SELECT a.id INTO v_actor
    FROM public.trade_marketplace_actors a
    JOIN public.trade_marketplace_supplier_offerings o2
      ON o2.supplier_catalog_id = a.supplier_catalog_id
    WHERE o2.id = p_offering_id
    LIMIT 1;

    -- Evaluar condición particular (si existe)
    IF p_org_id IS NOT NULL AND v_actor IS NOT NULL THEN
      DECLARE
        v_cond_id     uuid;
        v_desc_pct    numeric;
        v_cond_until  timestamptz;
        v_cprice_id   uuid;
        v_cprice_neto numeric;
        v_cprice_until timestamptz;
        v_precio_desc  numeric;
      BEGIN
        SELECT c.id, c.descuento_pct INTO v_cond_id, v_desc_pct
        FROM public.trade_marketplace_actor_org_conditions c
        WHERE c.actor_id = v_actor AND c.org_id = p_org_id
          AND c.activa = true
          AND c.valid_from <= p_at
          AND (c.valid_until IS NULL OR c.valid_until > p_at)
        LIMIT 1;

        IF FOUND THEN
          -- Precio específico por offering
          SELECT cp.id, cp.precio_neto, cp.valid_until
          INTO v_cprice_id, v_cprice_neto, v_cprice_until
          FROM public.trade_marketplace_actor_org_condition_prices cp
          WHERE cp.condition_id = v_cond_id AND cp.offering_id = p_offering_id
            AND cp.activa = true
            AND cp.valid_from <= p_at
            AND (cp.valid_until IS NULL OR cp.valid_until > p_at)
          LIMIT 1;

          -- Precio por descuento general
          IF v_desc_pct IS NOT NULL THEN
            v_precio_desc := v_pvd * (1 - v_desc_pct / 100);
          END IF;

          -- C2: evaluar los dos candidatos de condición y quedarse con el más bajo
          IF v_cprice_neto IS NOT NULL AND v_precio_desc IS NOT NULL THEN
            IF v_cprice_neto <= v_precio_desc AND v_cprice_neto < v_best_precio THEN
              v_best_precio  := v_cprice_neto;
              v_best_tipo    := 'condicion_particular';
              v_best_regla   := 'condicion_precio_especifico';
              v_best_cond_id := v_cond_id;
              v_best_cpri_id := v_cprice_id;
              v_best_until   := v_cprice_until;
            ELSIF v_precio_desc < v_cprice_neto AND v_precio_desc < v_best_precio THEN
              v_best_precio  := v_precio_desc;
              v_best_tipo    := 'condicion_particular';
              v_best_regla   := 'condicion_descuento_pct';
              v_best_cond_id := v_cond_id;
              v_best_cpri_id := NULL;
              v_best_until   := NULL;
            END IF;
          ELSIF v_cprice_neto IS NOT NULL AND v_cprice_neto < v_best_precio THEN
            v_best_precio  := v_cprice_neto;
            v_best_tipo    := 'condicion_particular';
            v_best_regla   := 'condicion_precio_especifico';
            v_best_cond_id := v_cond_id;
            v_best_cpri_id := v_cprice_id;
            v_best_until   := v_cprice_until;
          ELSIF v_precio_desc IS NOT NULL AND v_precio_desc < v_best_precio THEN
            v_best_precio  := v_precio_desc;
            v_best_tipo    := 'condicion_particular';
            v_best_regla   := 'condicion_descuento_pct';
            v_best_cond_id := v_cond_id;
            v_best_cpri_id := NULL;
            v_best_until   := NULL;
          END IF;
        END IF;
      END;
    END IF;

    -- Evaluar promo profesional (independiente, C2: compite contra todo)
    DECLARE
      v_promo_id    uuid;
      v_promo_precio numeric;
      v_promo_until  timestamptz;
    BEGIN
      SELECT p.id, p.precio_promo_neto, p.valid_until
      INTO v_promo_id, v_promo_precio, v_promo_until
      FROM public.trade_marketplace_offering_promos p
      WHERE p.offering_id = p_offering_id
        AND p.activa = true
        AND p.audience IN ('professional', 'both')
        AND p.valid_from <= p_at AND p.valid_until > p_at
        AND p.precio_promo_neto < v_pvd
      ORDER BY p.precio_promo_neto ASC
      LIMIT 1;

      -- C2: la promo gana solo si es el precio más bajo de todos los evaluados
      IF FOUND AND v_promo_precio < v_best_precio THEN
        v_best_precio  := v_promo_precio;
        v_best_tipo    := 'promo_profesional';
        v_best_regla   := 'promo_activa_gana_por_min';
        v_best_prom_id := v_promo_id;
        v_best_cond_id := NULL;
        v_best_cpri_id := NULL;
        v_best_until   := v_promo_until;
      END IF;
    END;

  END IF;

  RETURN QUERY SELECT
    round(v_best_precio, 4),
    round(v_best_precio * (1 + v_o.tax_rate / 100), 4),
    v_o.tax_rate,
    v_o.currency,
    v_best_tipo,
    v_best_regla,
    v_best_prom_id,
    v_best_cond_id,
    v_best_cpri_id,
    1::int,
    v_best_until;
END;
$$;

COMMENT ON FUNCTION public.resolve_effective_offering_price
  IS 'Resuelve precio efectivo evaluando TODOS los candidatos y seleccionando MIN. Sin acumulación de descuentos. resolution_version=1.';;
