
-- Precios de mercado España 2024 (sin IVA, mano de obra + materiales típicos)
-- Lógica: oficio → unidad → rango precio
UPDATE public.trade_actuaciones
SET
  precio_min = CASE oficio
    WHEN 'electricidad' THEN CASE
      WHEN unidad ILIKE '%punto%'  THEN 40
      WHEN unidad ILIKE '%ml%'     THEN 5
      WHEN unidad ILIKE '%m2%'     THEN 8
      WHEN unidad ILIKE '%kw%'     THEN 120
      WHEN unidad ILIKE '%pa%'     THEN 300
      ELSE 55
    END
    WHEN 'fontaneria' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 30
      WHEN unidad ILIKE '%ml%'     THEN 22
      WHEN unidad ILIKE '%pa%'     THEN 400
      WHEN unidad ILIKE '%m3%'     THEN 80
      ELSE 85
    END
    WHEN 'pintura' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 4
      WHEN unidad ILIKE '%ml%'     THEN 8
      WHEN unidad ILIKE '%pa%'     THEN 200
      ELSE 25
    END
    WHEN 'albanileria' THEN CASE
      WHEN unidad ILIKE '%m3%'     THEN 55
      WHEN unidad ILIKE '%m2%'     THEN 22
      WHEN unidad ILIKE '%ml%'     THEN 25
      WHEN unidad ILIKE '%pa%'     THEN 600
      ELSE 150
    END
    WHEN 'pladur_escayola' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 25
      WHEN unidad ILIKE '%ml%'     THEN 15
      WHEN unidad ILIKE '%pa%'     THEN 300
      ELSE 60
    END
    WHEN 'climatizacion' THEN CASE
      WHEN unidad ILIKE '%kw%'     THEN 90
      WHEN unidad ILIKE '%m2%'     THEN 15
      WHEN unidad ILIKE '%ml%'     THEN 20
      WHEN unidad ILIKE '%pa%'     THEN 800
      ELSE 250
    END
    WHEN 'persianas' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 60
      WHEN unidad ILIKE '%ml%'     THEN 40
      WHEN unidad ILIKE '%pa%'     THEN 400
      ELSE 100
    END
    WHEN 'suelos_alicatados' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 25
      WHEN unidad ILIKE '%ml%'     THEN 15
      WHEN unidad ILIKE '%pa%'     THEN 400
      ELSE 40
    END
    WHEN 'cerrajeria' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 60
      WHEN unidad ILIKE '%ml%'     THEN 30
      WHEN unidad ILIKE '%pa%'     THEN 500
      ELSE 90
    END
    WHEN 'fachadas' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 15
      WHEN unidad ILIKE '%ml%'     THEN 20
      WHEN unidad ILIKE '%pa%'     THEN 1000
      ELSE 30
    END
    WHEN 'cristaleria' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 60
      WHEN unidad ILIKE '%ml%'     THEN 30
      WHEN unidad ILIKE '%pa%'     THEN 400
      ELSE 80
    END
    WHEN 'mantenimiento_general' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 8
      WHEN unidad ILIKE '%ml%'     THEN 15
      WHEN unidad ILIKE '%hora%'   THEN 28
      WHEN unidad ILIKE '%pa%'     THEN 200
      ELSE 45
    END
    WHEN 'cubiertas' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 30
      WHEN unidad ILIKE '%ml%'     THEN 25
      WHEN unidad ILIKE '%pa%'     THEN 600
      ELSE 80
    END
    WHEN 'carpinteria' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 120
      WHEN unidad ILIKE '%ml%'     THEN 50
      WHEN unidad ILIKE '%pa%'     THEN 600
      ELSE 200
    END
    WHEN 'impermeabilizacion' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 15
      WHEN unidad ILIKE '%ml%'     THEN 20
      WHEN unidad ILIKE '%pa%'     THEN 400
      ELSE 25
    END
    WHEN 'jardineria' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 8
      WHEN unidad ILIKE '%ml%'     THEN 12
      WHEN unidad ILIKE '%hora%'   THEN 25
      WHEN unidad ILIKE '%pa%'     THEN 300
      ELSE 30
    END
    WHEN 'reformas_integrales' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 250
      WHEN unidad ILIKE '%pa%'     THEN 8000
      ELSE 350
    END
    WHEN 'contra_incendios' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 3
      WHEN unidad ILIKE '%ml%'     THEN 5
      WHEN unidad ILIKE '%pa%'     THEN 300
      ELSE 60
    END
    WHEN 'energia_solar' THEN CASE
      WHEN unidad ILIKE '%kw%'     THEN 800
      WHEN unidad ILIKE '%m2%'     THEN 200
      WHEN unidad ILIKE '%pa%'     THEN 2000
      ELSE 300
    END
    WHEN 'telecomunicaciones' THEN CASE
      WHEN unidad ILIKE '%punto%'  THEN 25
      WHEN unidad ILIKE '%ml%'     THEN 5
      WHEN unidad ILIKE '%pa%'     THEN 200
      ELSE 45
    END
    ELSE 50
  END,

  precio_max = CASE oficio
    WHEN 'electricidad' THEN CASE
      WHEN unidad ILIKE '%punto%'  THEN 95
      WHEN unidad ILIKE '%ml%'     THEN 18
      WHEN unidad ILIKE '%m2%'     THEN 22
      WHEN unidad ILIKE '%kw%'     THEN 280
      WHEN unidad ILIKE '%pa%'     THEN 1500
      ELSE 220
    END
    WHEN 'fontaneria' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 90
      WHEN unidad ILIKE '%ml%'     THEN 65
      WHEN unidad ILIKE '%pa%'     THEN 3000
      WHEN unidad ILIKE '%m3%'     THEN 200
      ELSE 400
    END
    WHEN 'pintura' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 16
      WHEN unidad ILIKE '%ml%'     THEN 28
      WHEN unidad ILIKE '%pa%'     THEN 2000
      ELSE 200
    END
    WHEN 'albanileria' THEN CASE
      WHEN unidad ILIKE '%m3%'     THEN 220
      WHEN unidad ILIKE '%m2%'     THEN 110
      WHEN unidad ILIKE '%ml%'     THEN 130
      WHEN unidad ILIKE '%pa%'     THEN 10000
      ELSE 3000
    END
    WHEN 'pladur_escayola' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 65
      WHEN unidad ILIKE '%ml%'     THEN 50
      WHEN unidad ILIKE '%pa%'     THEN 2000
      ELSE 280
    END
    WHEN 'climatizacion' THEN CASE
      WHEN unidad ILIKE '%kw%'     THEN 260
      WHEN unidad ILIKE '%m2%'     THEN 50
      WHEN unidad ILIKE '%ml%'     THEN 85
      WHEN unidad ILIKE '%pa%'     THEN 8000
      ELSE 3500
    END
    WHEN 'persianas' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 210
      WHEN unidad ILIKE '%ml%'     THEN 160
      WHEN unidad ILIKE '%pa%'     THEN 2500
      ELSE 550
    END
    WHEN 'suelos_alicatados' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 95
      WHEN unidad ILIKE '%ml%'     THEN 65
      WHEN unidad ILIKE '%pa%'     THEN 3000
      ELSE 220
    END
    WHEN 'cerrajeria' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 320
      WHEN unidad ILIKE '%ml%'     THEN 160
      WHEN unidad ILIKE '%pa%'     THEN 4000
      ELSE 900
    END
    WHEN 'fachadas' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 75
      WHEN unidad ILIKE '%ml%'     THEN 95
      WHEN unidad ILIKE '%pa%'     THEN 20000
      ELSE 3500
    END
    WHEN 'cristaleria' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 380
      WHEN unidad ILIKE '%ml%'     THEN 165
      WHEN unidad ILIKE '%pa%'     THEN 3000
      ELSE 650
    END
    WHEN 'mantenimiento_general' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 35
      WHEN unidad ILIKE '%ml%'     THEN 65
      WHEN unidad ILIKE '%hora%'   THEN 75
      WHEN unidad ILIKE '%pa%'     THEN 2000
      ELSE 300
    END
    WHEN 'cubiertas' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 140
      WHEN unidad ILIKE '%ml%'     THEN 110
      WHEN unidad ILIKE '%pa%'     THEN 8000
      ELSE 650
    END
    WHEN 'carpinteria' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 650
      WHEN unidad ILIKE '%ml%'     THEN 270
      WHEN unidad ILIKE '%pa%'     THEN 6000
      ELSE 3500
    END
    WHEN 'impermeabilizacion' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 70
      WHEN unidad ILIKE '%ml%'     THEN 85
      WHEN unidad ILIKE '%pa%'     THEN 4000
      ELSE 280
    END
    WHEN 'jardineria' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 50
      WHEN unidad ILIKE '%ml%'     THEN 60
      WHEN unidad ILIKE '%hora%'   THEN 65
      WHEN unidad ILIKE '%pa%'     THEN 4000
      ELSE 600
    END
    WHEN 'reformas_integrales' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 950
      WHEN unidad ILIKE '%pa%'     THEN 90000
      ELSE 900
    END
    WHEN 'contra_incendios' THEN CASE
      WHEN unidad ILIKE '%m2%'     THEN 20
      WHEN unidad ILIKE '%ml%'     THEN 32
      WHEN unidad ILIKE '%pa%'     THEN 2500
      ELSE 650
    END
    WHEN 'energia_solar' THEN CASE
      WHEN unidad ILIKE '%kw%'     THEN 2600
      WHEN unidad ILIKE '%m2%'     THEN 650
      WHEN unidad ILIKE '%pa%'     THEN 25000
      ELSE 1800
    END
    WHEN 'telecomunicaciones' THEN CASE
      WHEN unidad ILIKE '%punto%'  THEN 90
      WHEN unidad ILIKE '%ml%'     THEN 22
      WHEN unidad ILIKE '%pa%'     THEN 1500
      ELSE 250
    END
    ELSE 500
  END,

  updated_at = NOW()

WHERE precio_min IS NULL;
;
