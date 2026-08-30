
INSERT INTO public.trade_supplier_catalogs
  (supplier_key, supplier_name, is_active, margen_pct_default, prioridad, is_custom, acuerdo_estado)
SELECT 'saunier_duval','Saunier Duval',true,32,7,false,'activo'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_supplier_catalogs WHERE supplier_key = 'saunier_duval');

INSERT INTO public.trade_supplier_products (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo)
SELECT c.id, v.ref, v.descr, v.marca, v.familia, v.precio::numeric, v.unidad, true
FROM public.trade_supplier_catalogs c
CROSS JOIN (VALUES
  -- Calderas condensación mural gas
  ('SDV-CAL-101','Caldera condensación mural gas nat. 18kW Themaclassic','Saunier Duval','Calderas','680.00','ud'),
  ('SDV-CAL-102','Caldera condensación mural gas nat. 24kW Themaclassic','Saunier Duval','Calderas','750.00','ud'),
  ('SDV-CAL-103','Caldera condensación mural gas nat. 28kW Themaclassic','Saunier Duval','Calderas','820.00','ud'),
  ('SDV-CAL-104','Caldera condensación mural gas nat. 24kW Isofast Condens','Saunier Duval','Calderas','950.00','ud'),
  ('SDV-CAL-105','Caldera condensación mural gas nat. 35kW Isofast Condens','Saunier Duval','Calderas','1100.00','ud'),
  ('SDV-CAL-106','Caldera condensación mural 24kW con depósito 46L Genia Mod','Saunier Duval','Calderas','1280.00','ud'),
  ('SDV-CAL-107','Caldera condensación mural 30kW con depósito 60L Genia Mod','Saunier Duval','Calderas','1450.00','ud'),
  ('SDV-CAL-108','Caldera condensación suelo 45kW Thema Classic Floor','Saunier Duval','Calderas','2200.00','ud'),
  ('SDV-CAL-109','Caldera condensación suelo 80kW industrial','Saunier Duval','Calderas','3800.00','ud'),
  ('SDV-CAL-110','Caldera mixta condensación 20kW Themaclassic C20E','Saunier Duval','Calderas','720.00','ud'),
  -- Calderas biomasa / pellet
  ('SDV-BIO-101','Caldera pellet 15kW con depósito 200L','Saunier Duval','Biomasa','3200.00','ud'),
  ('SDV-BIO-102','Caldera pellet 25kW con depósito 320L','Saunier Duval','Biomasa','4500.00','ud'),
  -- Termostatos y control
  ('SDV-TER-101','Termostato ambiente OpenTherm programable','Saunier Duval','Control','85.00','ud'),
  ('SDV-TER-102','Termostato WiFi compatible OpenTherm','Saunier Duval','Control','125.00','ud'),
  ('SDV-TER-103','Kit regulación zona 3 vías motorizada','Saunier Duval','Control','145.00','ud'),
  ('SDV-TER-104','Sonda exterior para regulación climatización','Saunier Duval','Control','38.00','ud'),
  ('SDV-TER-105','Módulo cascada para 2 calderas','Saunier Duval','Control','285.00','ud'),
  -- ACS / Acumuladores
  ('SDV-ACS-101','Acumulador ACS 100L indirecto Saunierstore','Saunier Duval','ACS','420.00','ud'),
  ('SDV-ACS-102','Acumulador ACS 150L indirecto Saunierstore','Saunier Duval','ACS','520.00','ud'),
  ('SDV-ACS-103','Acumulador ACS 200L indirecto Saunierstore','Saunier Duval','ACS','680.00','ud'),
  ('SDV-ACS-104','Calentador instantáneo gas 14L/min Opalia C14','Saunier Duval','ACS','320.00','ud'),
  ('SDV-ACS-105','Calentador instantáneo gas 11L/min butano','Saunier Duval','ACS','280.00','ud'),
  -- Energía solar térmica
  ('SDV-SOL-101','Colector solar plano 2.5m2 SF8','Saunier Duval','Solar térmica','580.00','ud'),
  ('SDV-SOL-102','Kit solar térmico 2 colectores + acum. 300L','Saunier Duval','Solar térmica','2200.00','ud'),
  ('SDV-SOL-103','Central solar con bomba y vaso expansión','Saunier Duval','Solar térmica','450.00','ud'),
  -- Bomba de calor
  ('SDV-BDC-101','Bomba calor aerotermia 6kW Genia Air 6','Saunier Duval','Bomba de calor','2600.00','ud'),
  ('SDV-BDC-102','Bomba calor aerotermia 8kW Genia Air 8','Saunier Duval','Bomba de calor','3100.00','ud'),
  ('SDV-BDC-103','Bomba calor aerotermia 12kW Genia Air 12','Saunier Duval','Bomba de calor','4200.00','ud'),
  -- Accesorios caldera
  ('SDV-ACC-101','Kit evacuación coaxial 60/100mm 1m','Saunier Duval','Accesorios','28.00','ud'),
  ('SDV-ACC-102','Kit evacuación coaxial 60/100mm extensión 1m','Saunier Duval','Accesorios','18.00','ud'),
  ('SDV-ACC-103','Kit evacuación separado 80mm 2 tubos 1m','Saunier Duval','Accesorios','45.00','ud'),
  ('SDV-ACC-104','Vaso expansión calefacción 12L recambio','Saunier Duval','Accesorios','42.00','ud'),
  ('SDV-ACC-105','Válvula de seguridad 3 bar recambio','Saunier Duval','Accesorios','18.00','ud'),
  ('SDV-ACC-106','Bomba circuladora recambio caldera','Saunier Duval','Accesorios','85.00','ud'),
  ('SDV-ACC-107','Intercambiador de placas recambio 24kW','Saunier Duval','Accesorios','125.00','ud'),
  ('SDV-ACC-108','Kit llenado calefacción automático','Saunier Duval','Accesorios','45.00','ud'),
  ('SDV-ACC-109','Manómetro presión caldera recambio','Saunier Duval','Accesorios','22.00','ud'),
  ('SDV-ACC-110','Purgador automático aire caldera','Saunier Duval','Accesorios','12.00','ud'),
  -- Radiadores de aluminio
  ('SDV-RAD-101','Radiador aluminio 6 elementos 600mm Dubal 60','Saunier Duval','Radiadores','88.00','ud'),
  ('SDV-RAD-102','Radiador aluminio 8 elementos 600mm Dubal 60','Saunier Duval','Radiadores','112.00','ud'),
  ('SDV-RAD-103','Radiador aluminio 10 elementos 600mm Dubal 60','Saunier Duval','Radiadores','138.00','ud'),
  ('SDV-RAD-104','Radiador aluminio 12 elementos 600mm Dubal 60','Saunier Duval','Radiadores','165.00','ud'),
  ('SDV-RAD-105','Radiador aluminio 6 elementos 700mm Dubal 70','Saunier Duval','Radiadores','105.00','ud'),
  ('SDV-RAD-106','Radiador panel acero 22-600x800 blanco','Saunier Duval','Radiadores','92.00','ud'),
  ('SDV-RAD-107','Radiador panel acero 22-600x1200 blanco','Saunier Duval','Radiadores','128.00','ud'),
  ('SDV-RAD-108','Cabezal termostático radiador M30x1.5','Saunier Duval','Radiadores','22.00','ud'),
  ('SDV-RAD-109','Válvula termostática radiador recto 1/2','Saunier Duval','Radiadores','18.00','ud'),
  ('SDV-RAD-110','Detentor retorno radiador 1/2 recto','Saunier Duval','Radiadores','16.00','ud')
) AS v(ref, descr, marca, familia, precio, unidad)
WHERE c.supplier_key = 'saunier_duval'
AND NOT EXISTS (
  SELECT 1 FROM public.trade_supplier_products p2
  WHERE p2.catalog_id = c.id AND p2.ref_proveedor = v.ref
);

UPDATE public.trade_supplier_products p
SET search_vector = to_tsvector('spanish',
  coalesce(p.descripcion,'') || ' ' || coalesce(p.familia,'') || ' ' || coalesce(p.marca,''))
FROM public.trade_supplier_catalogs c
WHERE p.catalog_id = c.id AND c.supplier_key = 'saunier_duval' AND p.search_vector IS NULL;
;
