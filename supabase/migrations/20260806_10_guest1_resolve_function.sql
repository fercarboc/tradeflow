-- Sprint Guest-1 · Migración 10
-- Objetivo: resolve_effective_offering_price — evaluación MIN de todos los precios válidos
-- C2: Recoge TODOS los candidatos válidos, selecciona MIN, no acumula descuentos.
--     Ejemplo: PVD=100, condición=90, promo=80 → resultado: 80, tipo=promo_profesional
--     Devuelve también: promotion_id, condition_id, condition_price_id,
--                       resolution_version, valid_until

BEGIN;

-- DROP + CREATE porque cambia RETURNS TABLE
DROP FUNCTION IF EXISTS public.resolve_effective_offering_price(uuid, text, uuid, numeric, timestamptz);

CREATE FUNCTION public.resolve_effective_offering_price(
  p_offering_id     uuid,
  p_buyer_mode      text,           -- 'public' | 'professional'
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
  v_cond         RECORD;
  -- Candidatos de precio
  v_pvd          numeric;
  v_pvp          numeric;
  v_best_precio  numeric;
  v_best_tipo    text;
  v_best_regla   text;
  v_best_prom_id uuid;
  v_best_cond_id uuid;
  v_best_cpri_id uuid;
  v_best_until   timestamptz;
BEGIN
  -- ─── 1. Validar modo ──────────────────────────────────────────────────────
  IF p_buyer_mode NOT IN ('public', 'professional') THEN
    RAISE EXCEPTION 'INVALID_BUYER_MODE: %', p_buyer_mode;
  END IF;

  -- ─── 2. Cargar offering ───────────────────────────────────────────────────
  SELECT
    o.precio_profesional_neto,
    o.precio_publico_neto,
    o.tax_rate,
    o.currency,
    o.venta_publica_habilitada,
    o.venta_profesional_habilitada
  INTO v_o
  FROM public.trade_marketplace_supplier_offerings o
  WHERE o.id = p_offering_id AND o.activa = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OFFERING_NOT_FOUND: %', p_offering_id;
  END IF;

  -- ─── 3. Modo PÚBLICO ──────────────────────────────────────────────────────
  IF p_buyer_mode = 'public' THEN

    IF NOT v_o.venta_publica_habilitada OR v_o.precio_publico_neto IS NULL THEN
      RAISE EXCEPTION 'PUBLIC_SALE_NOT_AVAILABLE: offering %', p_offering_id;
    END IF;

    v_pvp         := v_o.precio_publico_neto;
    v_best_precio := v_pvp;
    v_best_tipo   := 'pvp';
    v_best_regla  := 'PVP_base';
    v_best_until  := NULL;

    -- Buscar promo pública vigente más barata
    SELECT p.id, p.precio_promo_neto, p.valid_until
    INTO v_best_prom_id, v_best_precio, v_best_until
    FROM public.trade_marketplace_offering_promos p
    WHERE p.offering_id = p_offering_id
      AND p.activa      = true
      AND p.audience    IN ('public', 'both')
      AND p.valid_from  <= p_at
      AND p.valid_until >  p_at
      AND p.precio_promo_neto < v_pvp   -- solo si mejora el PVP base
    ORDER BY p.precio_promo_neto ASC
    LIMIT 1;

    IF FOUND THEN
      v_best_tipo  := 'promo_publica';
      v_best_regla := 'promo_activa_mejora_pvp';
    ELSE
      -- Sin promo → PVP base (restaurar por si la subquery no encontró nada)
      v_best_precio  := v_pvp;
      v_best_tipo    := 'pvp';
      v_best_regla   := 'PVP_base';
      v_best_prom_id := NULL;
      v_best_until   := NULL;
    END IF;

  -- ─── 4. Modo PROFESIONAL ─────────────────────────────────────────────────
  ELSE

    IF NOT v_o.venta_profesional_habilitada OR v_o.precio_profesional_neto IS NULL THEN
      RAISE EXCEPTION 'PROFESSIONAL_SALE_NOT_AVAILABLE: offering %', p_offering_id;
    END IF;

    v_pvd := v_o.precio_profesional_neto;

    -- Arrancar con PVD base como precio mínimo provisional
    v_best_precio  := v_pvd;
    v_best_tipo    := 'pvd';
    v_best_regla   := 'PVD_base';
    v_best_prom_id := NULL;
    v_best_cond_id := NULL;
    v_best_cpri_id := NULL;
    v_best_until   := NULL;

    -- Obtener actor desde offering → catalog → actor
    SELECT a.id INTO v_actor
    FROM public.trade_marketplace_actors a
    JOIN public.trade_marketplace_supplier_offerings o2
      ON o2.supplier_catalog_id = a.supplier_catalog_id
    WHERE o2.id = p_offering_id
    LIMIT 1;

    -- ── 4a. Condición particular (si existe y está vigente) ─────────────────
    IF p_org_id IS NOT NULL AND v_actor IS NOT NULL THEN

      SELECT c.id, c.descuento_pct INTO v_cond
      FROM public.trade_marketplace_actor_org_conditions c
      WHERE c.actor_id  = v_actor
        AND c.org_id    = p_org_id
        AND c.activa    = true
        AND c.valid_from <= p_at
        AND (c.valid_until IS NULL OR c.valid_until > p_at)
      LIMIT 1;

      IF FOUND THEN
        DECLARE
          v_precio_especifico   numeric;
          v_precio_descuento    numeric;
          v_cond_price_id       uuid;
          v_cond_price_until    timestamptz;
        BEGIN
          -- 4a-i. Precio específico para esta offering en la tabla hija
          SELECT cp.id, cp.precio_neto, cp.valid_until
          INTO v_cond_price_id, v_precio_especifico, v_cond_price_until
          FROM public.trade_marketplace_actor_org_condition_prices cp
          WHERE cp.condition_id = v_cond.id
            AND cp.offering_id  = p_offering_id
            AND cp.activa       = true
            AND cp.valid_from   <= p_at
            AND (cp.valid_until IS NULL OR cp.valid_until > p_at)
          LIMIT 1;

          -- 4a-ii. Precio por descuento general sobre PVD
          IF v_cond.descuento_pct IS NOT NULL THEN
            v_precio_descuento := v_pvd * (1 - v_cond.descuento_pct / 100);
          END IF;

          -- C2: Seleccionar el más favorable entre precio_especifico y descuento_pct
          -- No acumular: si ambos existen, ganará el menor precio absoluto.
          IF v_precio_especifico IS NOT NULL AND v_precio_descuento IS NOT NULL THEN
            IF v_precio_especifico <= v_precio_descuento THEN
              IF v_precio_especifico < v_best_precio THEN
                v_best_precio  := v_precio_especifico;
                v_best_tipo    := 'condicion_particular';
                v_best_regla   := 'condicion_precio_especifico';
                v_best_cond_id := v_cond.id;
                v_best_cpri_id := v_cond_price_id;
                v_best_until   := v_cond_price_until;
              END IF;
            ELSE
              IF v_precio_descuento < v_best_precio THEN
                v_best_precio  := v_precio_descuento;
                v_best_tipo    := 'condicion_particular';
                v_best_regla   := 'condicion_descuento_pct';
                v_best_cond_id := v_cond.id;
                v_best_cpri_id := NULL;
                v_best_until   := NULL;
              END IF;
            END IF;
          ELSIF v_precio_especifico IS NOT NULL THEN
            IF v_precio_especifico < v_best_precio THEN
              v_best_precio  := v_precio_especifico;
              v_best_tipo    := 'condicion_particular';
              v_best_regla   := 'condicion_precio_especifico';
              v_best_cond_id := v_cond.id;
              v_best_cpri_id := v_cond_price_id;
              v_best_until   := v_cond_price_until;
            END IF;
          ELSIF v_precio_descuento IS NOT NULL THEN
            IF v_precio_descuento < v_best_precio THEN
              v_best_precio  := v_precio_descuento;
              v_best_tipo    := 'condicion_particular';
              v_best_regla   := 'condicion_descuento_pct';
              v_best_cond_id := v_cond.id;
              v_best_cpri_id := NULL;
              v_best_until   := NULL;
            END IF;
          END IF;
        END;
      END IF;
    END IF;

    -- ── 4b. Promo profesional (evalúa independientemente, C2: MIN de todos) ─
    DECLARE
      v_promo_precio numeric;
      v_promo_id     uuid;
      v_promo_until  timestamptz;
    BEGIN
      SELECT p.id, p.precio_promo_neto, p.valid_until
      INTO v_promo_id, v_promo_precio, v_promo_until
      FROM public.trade_marketplace_offering_promos p
      WHERE p.offering_id = p_offering_id
        AND p.activa      = true
        AND p.audience    IN ('professional', 'both')
        AND p.valid_from  <= p_at
        AND p.valid_until >  p_at
        AND p.precio_promo_neto < v_pvd  -- solo promos que mejoran PVD base
      ORDER BY p.precio_promo_neto ASC
      LIMIT 1;

      -- C2: La promo compite contra el precio actual (condición o PVD).
      -- Gana el más bajo entre todos los candidatos evaluados.
      IF FOUND AND v_promo_precio < v_best_precio THEN
        v_best_precio  := v_promo_precio;
        v_best_tipo    := 'promo_profesional';
        v_best_regla   := 'promo_activa_mejora_mejor_disponible';
        v_best_prom_id := v_promo_id;
        v_best_cond_id := NULL;
        v_best_cpri_id := NULL;
        v_best_until   := v_promo_until;
      END IF;
    END;

  END IF;

  -- ─── 5. Devolver resultado ─────────────────────────────────────────────────
  RETURN QUERY SELECT
    round(v_best_precio, 4)                                  AS precio_neto,
    round(v_best_precio * (1 + v_o.tax_rate / 100), 4)      AS precio_con_iva,
    v_o.tax_rate,
    v_o.currency,
    v_best_tipo                                              AS precio_tipo,
    v_best_regla                                             AS regla_aplicada,
    v_best_prom_id                                           AS promotion_id,
    v_best_cond_id                                           AS condition_id,
    v_best_cpri_id                                           AS condition_price_id,
    1::int                                                   AS resolution_version,
    v_best_until                                             AS valid_until;

END;
$$;

COMMENT ON FUNCTION public.resolve_effective_offering_price
  IS 'Resuelve el precio efectivo evaluando TODOS los candidatos válidos y seleccionando MIN. Sin acumulación de descuentos. resolution_version=1.';

COMMIT;

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.resolve_effective_offering_price(uuid, text, uuid, numeric, timestamptz);
-- COMMIT;
