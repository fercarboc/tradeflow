
UPDATE public.trade_supplier_catalogs SET is_active=true, acuerdo_estado='activo' WHERE supplier_key='junkers';

INSERT INTO public.trade_supplier_products (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo)
SELECT c.id, v.ref, v.descr, v.marca, v.familia, v.precio::numeric, v.unidad, true
FROM public.trade_supplier_catalogs c
CROSS JOIN (VALUES
  ('JUN-CAL-101','Caldera condensación mural 24kW Cerapur Comfort ZWBC 24/28','Junkers','Calderas','780.00','ud'),
  ('JUN-CAL-102','Caldera condensación mural 28kW Cerapur Comfort ZWBC 28/36','Junkers','Calderas','860.00','ud'),
  ('JUN-CAL-103','Caldera condensación mural 35kW Cerapur Comfort ZWB 35-3A','Junkers','Calderas','980.00','ud'),
  ('JUN-CAL-104','Caldera condensación mural 20kW Cerapur Smart ZWB 20-5C','Junkers','Calderas','720.00','ud'),
  ('JUN-CAL-105','Caldera condensación suelo 30kW Suprapur KBR 30','Junkers','Calderas','2400.00','ud'),
  ('JUN-CAL-106','Caldera condensación suelo 60kW Suprapur KBR 60','Junkers','Calderas','4200.00','ud'),
  ('JUN-ACS-101','Calentador instantáneo gas nat. 11L/min HydroCompact','Junkers','ACS','295.00','ud'),
  ('JUN-ACS-102','Calentador instantáneo gas nat. 14L/min HydroCompact','Junkers','ACS','345.00','ud'),
  ('JUN-ACS-103','Calentador instantáneo gas but. 11L/min WR11','Junkers','ACS','265.00','ud'),
  ('JUN-ACS-104','Acumulador ACS 120L indirecto SK127','Junkers','ACS','420.00','ud'),
  ('JUN-ACS-105','Acumulador ACS 200L indirecto SK210','Junkers','ACS','620.00','ud'),
  ('JUN-ACS-106','Termoacumulador eléctrico 80L Elacell ES 80','Junkers','ACS','280.00','ud'),
  ('JUN-ACS-107','Termoacumulador eléctrico 150L Elacell ES 150','Junkers','ACS','380.00','ud'),
  ('JUN-BDC-101','Bomba calor aerotermia 6kW Compress 3000 AWS 6','Bosch','Bomba de calor','2700.00','ud'),
  ('JUN-BDC-102','Bomba calor aerotermia 8kW Compress 3000 AWS 8','Bosch','Bomba de calor','3300.00','ud'),
  ('JUN-BDC-103','Bomba calor aerotermia 13kW Compress 3000 AWS 13','Bosch','Bomba de calor','4500.00','ud'),
  ('JUN-CON-101','Termostato WiFi EasyControl CT200','Bosch','Control','125.00','ud'),
  ('JUN-CON-102','Control Modbus para caldera industrial','Junkers','Control','245.00','ud'),
  ('JUN-ACC-101','Kit evacuación coaxial 80/125mm 1m','Junkers','Accesorios','38.00','ud'),
  ('JUN-ACC-102','Vaso expansión 12L recambio Cerapur','Junkers','Accesorios','52.00','ud'),
  ('JUN-ACC-103','Bomba circuladora recambio Cerapur','Junkers','Accesorios','98.00','ud'),
  ('JUN-ACC-104','Intercambiador primario 24kW recambio','Junkers','Accesorios','142.00','ud'),
  ('JUN-ACC-105','Válvula 3 vías recambio caldera mixta','Junkers','Accesorios','68.00','ud')
) AS v(ref, descr, marca, familia, precio, unidad)
WHERE c.supplier_key='junkers'
AND NOT EXISTS (SELECT 1 FROM public.trade_supplier_products p2 WHERE p2.catalog_id=c.id AND p2.ref_proveedor=v.ref);

UPDATE public.trade_supplier_products p
SET search_vector=to_tsvector('spanish', coalesce(p.descripcion,'')||' '||coalesce(p.familia,'')||' '||coalesce(p.marca,''))
FROM public.trade_supplier_catalogs c
WHERE p.catalog_id=c.id AND c.supplier_key='junkers' AND p.search_vector IS NULL;
;
