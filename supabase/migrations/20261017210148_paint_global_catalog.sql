-- Catálogo de referencia: partidas de pintura
-- Precios: medias de mercado profesional España 2024-2025, sin IVA.
-- Solo partidas de ejecución y preparación (no suministro de materiales comerciales).

INSERT INTO public.trade_global_catalog
  (oficio, familia, codigo, descripcion, unidad, precio_referencia, activo)
VALUES
  ('pintura', 'Mano de obra', 'PINT-MO-001', 'Mano de obra pintura plástica interior paredes',    'm2', 9.50,  true),
  ('pintura', 'Mano de obra', 'PINT-MO-002', 'Mano de obra pintura plástica interior techos',     'm2', 11.00, true),
  ('pintura', 'Mano de obra', 'PINT-MO-003', 'Mano de obra esmaltado puertas interior',           'ud', 65.00, true),
  ('pintura', 'Mano de obra', 'PINT-MO-004', 'Mano de obra lacado puertas interior',              'ud', 90.00, true),
  ('pintura', 'Mano de obra', 'PINT-MO-005', 'Mano de obra barnizado carpintería madera',         'm2', 18.00, true),
  ('pintura', 'Mano de obra', 'PINT-MO-006', 'Mano de obra pintura fachada exterior',             'm2', 12.00, true),
  ('pintura', 'Mano de obra', 'PINT-MO-007', 'Mano de obra pintura antihumedad',                  'm2', 14.00, true),
  ('pintura', 'Preparación',  'PINT-PREP-001', 'Encintado de marcos puertas y ventanas',          'm',  0.20,  true),
  ('pintura', 'Preparación',  'PINT-PREP-002', 'Cubrición de suelos y mobiliario con plástico',   'm2', 0.50,  true),
  ('pintura', 'Preparación',  'PINT-PREP-003', 'Emplastecido y lijado de paredes',                'm2', 6.50,  true),
  ('pintura', 'Preparación',  'PINT-PREP-004', 'Rascado y saneado de superficie degradada',       'm2', 5.00,  true),
  ('pintura', 'Preparación',  'PINT-PREP-005', 'Imprimación selladora de paredes',                'm2', 2.50,  true),
  ('pintura', 'Preparación',  'PINT-PREP-006', 'Eliminación de gotelé y alisado posterior',       'm2', 18.00, true),
  ('pintura', 'Limpieza',     'PINT-LIMP-001', 'Limpieza y retirada de restos de pintura y plásticos', 'ud', 80.00, true)
ON CONFLICT (oficio, codigo) DO NOTHING;
