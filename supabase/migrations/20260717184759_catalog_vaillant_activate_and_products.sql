
UPDATE public.trade_supplier_catalogs SET is_active=true, acuerdo_estado='activo' WHERE supplier_key='vaillant';

INSERT INTO public.trade_supplier_products (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo)
SELECT c.id, v.ref, v.descr, v.marca, v.familia, v.precio::numeric, v.unidad, true
FROM public.trade_supplier_catalogs c
CROSS JOIN (VALUES
  ('VAI-CAL-101','Caldera condensación mural 20kW ecoTEC pure VUW 206/7-2','Vaillant','Calderas','720.00','ud'),
  ('VAI-CAL-102','Caldera condensación mural 25kW ecoTEC pure VUW 256/7-2','Vaillant','Calderas','795.00','ud'),
  ('VAI-CAL-103','Caldera condensación mural 28kW ecoTEC plus VU 286/5-5','Vaillant','Calderas','920.00','ud'),
  ('VAI-CAL-104','Caldera condensación mural 35kW ecoTEC plus VU 356/5-5','Vaillant','Calderas','1050.00','ud'),
  ('VAI-CAL-105','Caldera condensación mural 18kW ecoTEC pure solo calef.','Vaillant','Calderas','680.00','ud'),
  ('VAI-CAL-106','Caldera condensación suelo 25kW ecoVIT exclusiv','Vaillant','Calderas','2100.00','ud'),
  ('VAI-CAL-107','Caldera condensación suelo 45kW ecoVIT exclusiv','Vaillant','Calderas','3200.00','ud'),
  ('VAI-BDC-101','Bomba calor aerotermia 5kW arotherm plus VWL 55/6 A','Vaillant','Bomba de calor','2800.00','ud'),
  ('VAI-BDC-102','Bomba calor aerotermia 7kW arotherm plus VWL 75/6 A','Vaillant','Bomba de calor','3400.00','ud'),
  ('VAI-BDC-103','Bomba calor aerotermia 10kW arotherm plus VWL 105/6 A','Vaillant','Bomba de calor','4200.00','ud'),
  ('VAI-BDC-104','Bomba calor aerotermia 12kW arotherm plus VWL 125/6 A','Vaillant','Bomba de calor','4900.00','ud'),
  ('VAI-ACS-101','Acumulador ACS 150L uniSTOR VIH R 150/6','Vaillant','ACS','480.00','ud'),
  ('VAI-ACS-102','Acumulador ACS 200L uniSTOR VIH R 200/6','Vaillant','ACS','580.00','ud'),
  ('VAI-ACS-103','Acumulador ACS 300L uniSTOR VIH R 300/6','Vaillant','ACS','820.00','ud'),
  ('VAI-CON-101','Termostato WiFi vSMART','Vaillant','Control','145.00','ud'),
  ('VAI-CON-102','Termostato OpenTherm VRT 350','Vaillant','Control','95.00','ud'),
  ('VAI-CON-103','Módulo de zona ambiCONTROL','Vaillant','Control','185.00','ud'),
  ('VAI-ACC-101','Kit evacuación coaxial 60/100mm 1m','Vaillant','Accesorios','32.00','ud'),
  ('VAI-ACC-102','Vaso expansión 12L recambio ecoTEC','Vaillant','Accesorios','48.00','ud'),
  ('VAI-ACC-103','Bomba circuladora recambio ecoTEC','Vaillant','Accesorios','95.00','ud'),
  ('VAI-ACC-104','Intercambiador primario recambio 24kW','Vaillant','Accesorios','135.00','ud'),
  ('VAI-ACC-105','Válvula seguridad 3 bar recambio','Vaillant','Accesorios','18.00','ud')
) AS v(ref, descr, marca, familia, precio, unidad)
WHERE c.supplier_key='vaillant'
AND NOT EXISTS (SELECT 1 FROM public.trade_supplier_products p2 WHERE p2.catalog_id=c.id AND p2.ref_proveedor=v.ref);

UPDATE public.trade_supplier_products p
SET search_vector=to_tsvector('spanish', coalesce(p.descripcion,'')||' '||coalesce(p.familia,'')||' '||coalesce(p.marca,''))
FROM public.trade_supplier_catalogs c
WHERE p.catalog_id=c.id AND c.supplier_key='vaillant' AND p.search_vector IS NULL;
;
