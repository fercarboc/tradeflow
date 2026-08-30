
-- ═══════════════════════════════════════════════════════════════
-- SEED: Catálogos de proveedores globales
-- ═══════════════════════════════════════════════════════════════
INSERT INTO trade_supplier_catalogs
  (supplier_key, supplier_name, logo_url, is_active, margen_pct_default, prioridad, is_custom)
VALUES
  ('obramat',  'OBRAMAT',           null, true,  22, 1,  false),
  ('saltoki',  'Saltoki',           null, false, 28, 2,  false),
  ('sonepar',  'Sonepar',           null, false, 25, 3,  false),
  ('novelec',  'Novelec',           null, false, 26, 4,  false),
  ('rexel',    'Rexel',             null, false, 24, 5,  false),
  ('vaillant', 'Vaillant',          null, false, 30, 6,  false),
  ('junkers',  'Junkers / Bosch',   null, false, 30, 7,  false),
  ('ariston',  'Ariston',           null, false, 30, 8,  false),
  ('baxi',     'Baxi',              null, false, 28, 9,  false),
  ('ferroli',  'Ferroli',           null, false, 27, 10, false)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- SEED: Productos OBRAMAT de muestra (~65 referencias)
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  cat_id uuid;
BEGIN
  SELECT id INTO cat_id FROM trade_supplier_catalogs WHERE supplier_key = 'obramat' LIMIT 1;

  INSERT INTO trade_supplier_products
    (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad)
  VALUES
    -- ── ACS / AGUA CALIENTE SANITARIA ─────────────────────────
    (cat_id, 'OBR-ACS-001', 'Termo eléctrico vertical 50L', 'Fagor', 'ACS', 129.00, 'ud'),
    (cat_id, 'OBR-ACS-002', 'Termo eléctrico vertical 80L', 'Fagor', 'ACS', 159.00, 'ud'),
    (cat_id, 'OBR-ACS-003', 'Termo eléctrico vertical 100L', 'Fleck', 'ACS', 195.00, 'ud'),
    (cat_id, 'OBR-ACS-004', 'Termo eléctrico vertical 150L', 'Fleck', 'ACS', 249.00, 'ud'),
    (cat_id, 'OBR-ACS-005', 'Calentador a gas estanco 11L/min', 'Junkers', 'ACS', 285.00, 'ud'),
    (cat_id, 'OBR-ACS-006', 'Calentador a gas estanco 14L/min', 'Junkers', 'ACS', 320.00, 'ud'),
    (cat_id, 'OBR-ACS-007', 'Calentador a gas estanco 18L/min', 'Vaillant', 'ACS', 380.00, 'ud'),
    (cat_id, 'OBR-ACS-008', 'Válvula de seguridad 3 bar 3/4"', 'Watts', 'ACS', 8.50, 'ud'),
    (cat_id, 'OBR-ACS-009', 'Kit instalación termo (flexible + válvulas)', 'Genova', 'ACS', 22.00, 'ud'),
    (cat_id, 'OBR-ACS-010', 'Soporte mural para termo 50-80L', 'Cornat', 'ACS', 14.50, 'ud'),

    -- ── FONTANERÍA ────────────────────────────────────────────
    (cat_id, 'OBR-FON-001', 'Grifo monomando lavabo caño alto cromado', 'Roca', 'Fontanería', 45.00, 'ud'),
    (cat_id, 'OBR-FON-002', 'Grifo monomando lavabo caño bajo cromado', 'Roca', 'Fontanería', 38.00, 'ud'),
    (cat_id, 'OBR-FON-003', 'Grifo monomando fregadero giratorio cromado', 'Grohe', 'Fontanería', 72.00, 'ud'),
    (cat_id, 'OBR-FON-004', 'Grifo monomando ducha empotrado cromado', 'Hansgrohe', 'Fontanería', 89.00, 'ud'),
    (cat_id, 'OBR-FON-005', 'Grifo termostático ducha empotrado', 'Grohe', 'Fontanería', 165.00, 'ud'),
    (cat_id, 'OBR-FON-006', 'Válvula de esfera palanca 1/2" PN25', 'Giacomini', 'Fontanería', 6.80, 'ud'),
    (cat_id, 'OBR-FON-007', 'Válvula de esfera palanca 3/4" PN25', 'Giacomini', 'Fontanería', 9.20, 'ud'),
    (cat_id, 'OBR-FON-008', 'Válvula de esfera palanca 1" PN25', 'Giacomini', 'Fontanería', 13.50, 'ud'),
    (cat_id, 'OBR-FON-009', 'Sifón botella lavabo 1 1/4" PVC blanco', 'Jimten', 'Fontanería', 7.20, 'ud'),
    (cat_id, 'OBR-FON-010', 'Sifón botella bañera 1 1/2" PVC', 'Jimten', 'Fontanería', 12.50, 'ud'),
    (cat_id, 'OBR-FON-011', 'Plato ducha resina antideslizante 80x80 blanco', 'Roca', 'Fontanería', 189.00, 'ud'),
    (cat_id, 'OBR-FON-012', 'Plato ducha resina antideslizante 90x90 blanco', 'Roca', 'Fontanería', 215.00, 'ud'),
    (cat_id, 'OBR-FON-013', 'Plato ducha resina 120x80 extraplano blanco', 'Unisan', 'Fontanería', 269.00, 'ud'),
    (cat_id, 'OBR-FON-014', 'Mampara ducha angular 80x80 cristal 6mm', 'Profiltek', 'Fontanería', 245.00, 'ud'),
    (cat_id, 'OBR-FON-015', 'Mampara ducha frontal 120 abatible cristal 6mm', 'Profiltek', 'Fontanería', 295.00, 'ud'),
    (cat_id, 'OBR-FON-016', 'Inodoro compacto suspendido porcelana blanca', 'Roca', 'Fontanería', 195.00, 'ud'),
    (cat_id, 'OBR-FON-017', 'Inodoro suelo salida horizontal con cisterna', 'Jacob Delafon', 'Fontanería', 175.00, 'ud'),
    (cat_id, 'OBR-FON-018', 'Lavabo sobre encimera oval porcelana blanca', 'Roca', 'Fontanería', 89.00, 'ud'),
    (cat_id, 'OBR-FON-019', 'Tubería multicapa PEX-AL-PEX 16mm rollo 50m', 'Uponor', 'Fontanería', 68.00, 'rl'),
    (cat_id, 'OBR-FON-020', 'Tubería multicapa PEX-AL-PEX 20mm rollo 50m', 'Uponor', 'Fontanería', 92.00, 'rl'),
    (cat_id, 'OBR-FON-021', 'Tubo cobre 18mm rollo 25m', 'Retube', 'Fontanería', 74.00, 'rl'),
    (cat_id, 'OBR-FON-022', 'Tubo cobre 22mm rollo 25m', 'Retube', 'Fontanería', 98.00, 'rl'),
    (cat_id, 'OBR-FON-023', 'Ducha de mano + flexo 150cm cromado', 'Grohe', 'Fontanería', 35.00, 'ud'),
    (cat_id, 'OBR-FON-024', 'Columna de ducha termostática completa', 'Hansgrohe', 'Fontanería', 320.00, 'ud'),

    -- ── ELECTRICIDAD ─────────────────────────────────────────
    (cat_id, 'OBR-ELE-001', 'Cable H07V-K 1,5mm² amarillo-verde bobina 100m', 'Prysmian', 'Electricidad', 38.00, 'ud'),
    (cat_id, 'OBR-ELE-002', 'Cable H07V-K 1,5mm² azul bobina 100m', 'Prysmian', 'Electricidad', 38.00, 'ud'),
    (cat_id, 'OBR-ELE-003', 'Cable H07V-K 2,5mm² negro bobina 100m', 'Prysmian', 'Electricidad', 52.00, 'ud'),
    (cat_id, 'OBR-ELE-004', 'Cable H07V-K 4mm² negro bobina 100m', 'Prysmian', 'Electricidad', 78.00, 'ud'),
    (cat_id, 'OBR-ELE-005', 'Automático magnetotérmico 10A 1P+N 6kA', 'Schneider', 'Electricidad', 14.50, 'ud'),
    (cat_id, 'OBR-ELE-006', 'Automático magnetotérmico 16A 1P+N 6kA', 'Schneider', 'Electricidad', 14.50, 'ud'),
    (cat_id, 'OBR-ELE-007', 'Automático magnetotérmico 25A 1P+N 6kA', 'Schneider', 'Electricidad', 16.00, 'ud'),
    (cat_id, 'OBR-ELE-008', 'Automático magnetotérmico 40A 2P 6kA', 'Schneider', 'Electricidad', 28.00, 'ud'),
    (cat_id, 'OBR-ELE-009', 'Diferencial 40A 30mA 2P clase A', 'Schneider', 'Electricidad', 45.00, 'ud'),
    (cat_id, 'OBR-ELE-010', 'Diferencial 25A 30mA 2P clase AC', 'Legrand', 'Electricidad', 38.00, 'ud'),
    (cat_id, 'OBR-ELE-011', 'Mecanismo enchufe schuko 16A blanco', 'Simon', 'Electricidad', 8.90, 'ud'),
    (cat_id, 'OBR-ELE-012', 'Interruptor unipolar 10A blanco', 'Simon', 'Electricidad', 7.20, 'ud'),
    (cat_id, 'OBR-ELE-013', 'Conmutador 10A blanco', 'Simon', 'Electricidad', 8.50, 'ud'),
    (cat_id, 'OBR-ELE-014', 'Marco 1 elemento color blanco', 'Simon', 'Electricidad', 3.20, 'ud'),
    (cat_id, 'OBR-ELE-015', 'Luminaria panel LED 60x60 36W 4000K', 'Philips', 'Electricidad', 42.00, 'ud'),
    (cat_id, 'OBR-ELE-016', 'Downlight LED empotrado 12W 4000K blanco', 'Philips', 'Electricidad', 18.50, 'ud'),
    (cat_id, 'OBR-ELE-017', 'Tubo corrugado flexible PVC M20 rollo 50m', 'Aiscan', 'Electricidad', 22.00, 'rl'),
    (cat_id, 'OBR-ELE-018', 'Cuadro eléctrico 24 módulos superficie', 'Schneider', 'Electricidad', 35.00, 'ud'),

    -- ── CLIMATIZACIÓN ─────────────────────────────────────────
    (cat_id, 'OBR-CLI-001', 'Split inverter 2,5kW (9000 BTU) A++ Mitsubishi', 'Mitsubishi Electric', 'Climatización', 549.00, 'ud'),
    (cat_id, 'OBR-CLI-002', 'Split inverter 3,5kW (12000 BTU) A++ Mitsubishi', 'Mitsubishi Electric', 'Climatización', 699.00, 'ud'),
    (cat_id, 'OBR-CLI-003', 'Split inverter 5kW (18000 BTU) A+ Mitsubishi', 'Mitsubishi Electric', 'Climatización', 849.00, 'ud'),
    (cat_id, 'OBR-CLI-004', 'Split inverter 2,5kW (9000 BTU) A+++ Daikin', 'Daikin', 'Climatización', 629.00, 'ud'),
    (cat_id, 'OBR-CLI-005', 'Split inverter 3,5kW (12000 BTU) A+++ Daikin', 'Daikin', 'Climatización', 789.00, 'ud'),
    (cat_id, 'OBR-CLI-006', 'Split inverter 5kW (18000 BTU) A++ Daikin', 'Daikin', 'Climatización', 959.00, 'ud'),
    (cat_id, 'OBR-CLI-007', 'Tubería cobre frigorífica 1/4"+3/8" rollo 25m', 'Retube', 'Climatización', 89.00, 'rl'),
    (cat_id, 'OBR-CLI-008', 'Kit instalación split (tubos + manguera + soporte)', 'Genova', 'Climatización', 45.00, 'ud'),
    (cat_id, 'OBR-CLI-009', 'Soporte mural para unidad exterior split', 'Cornat', 'Climatización', 28.00, 'ud'),

    -- ── CONSTRUCCIÓN / AUXILIARES ─────────────────────────────
    (cat_id, 'OBR-CON-001', 'Mortero cola flexible C2TE 25kg', 'Mapei', 'Construcción', 18.50, 'sc'),
    (cat_id, 'OBR-CON-002', 'Mortero autonivelante suelo 25kg', 'Sika', 'Construcción', 22.00, 'sc'),
    (cat_id, 'OBR-CON-003', 'Silicona neutra sanitaria blanca 300ml', 'Soudal', 'Construcción', 5.80, 'ud'),
    (cat_id, 'OBR-CON-004', 'Silicona neutra transparente 300ml', 'Soudal', 'Construcción', 5.20, 'ud'),
    (cat_id, 'OBR-CON-005', 'Espuma de poliuretano expansiva 750ml', 'Soudal', 'Construcción', 9.50, 'ud'),
    (cat_id, 'OBR-CON-006', 'Pintura plástica interior blanca 15L', 'Titanlux', 'Construcción', 42.00, 'ud'),
    (cat_id, 'OBR-CON-007', 'Imprimación selladora multisoporte 5L', 'Mapei', 'Construcción', 28.00, 'ud'),
    (cat_id, 'OBR-CON-008', 'Rejilla ventilación plastico 10x10 blanca', 'Koolair', 'Construcción', 3.20, 'ud')
  ;
END $$;
;
