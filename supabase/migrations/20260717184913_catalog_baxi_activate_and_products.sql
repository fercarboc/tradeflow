
UPDATE public.trade_supplier_catalogs SET is_active=true, acuerdo_estado='activo' WHERE supplier_key='baxi';

INSERT INTO public.trade_supplier_products (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo)
SELECT c.id, v.ref, v.descr, v.marca, v.familia, v.precio::numeric, v.unidad, true
FROM public.trade_supplier_catalogs c
CROSS JOIN (VALUES
  ('BAX-CAL-101','Caldera condensación mural 24kW Duo-tec Compact E 24','Baxi','Calderas','730.00','ud'),
  ('BAX-CAL-102','Caldera condensación mural 28kW Duo-tec Compact E 28','Baxi','Calderas','810.00','ud'),
  ('BAX-CAL-103','Caldera condensación mural 33kW Duo-tec Compact E 33','Baxi','Calderas','900.00','ud'),
  ('BAX-CAL-104','Caldera condensación mural 24kW Luna Duo-tec MP 24','Baxi','Calderas','1050.00','ud'),
  ('BAX-CAL-105','Caldera condensación mural 35kW Luna Duo-tec MP 35','Baxi','Calderas','1250.00','ud'),
  ('BAX-CAL-106','Caldera condensación suelo 30kW Platinum Compact Plus 30','Baxi','Calderas','2200.00','ud'),
  ('BAX-CAL-107','Caldera condensación suelo 50kW Platinum Compact Plus 50','Baxi','Calderas','3500.00','ud'),
  ('BAX-CAL-108','Caldera mixta condensación 20kW solo butano/propano','Baxi','Calderas','680.00','ud'),
  ('BAX-ACS-101','Calentador instantáneo gas nat. 11L Nuvola3 B40','Baxi','ACS','285.00','ud'),
  ('BAX-ACS-102','Calentador instantáneo gas nat. 14L Nuvola3 B40','Baxi','ACS','335.00','ud'),
  ('BAX-ACS-103','Termoacumulador eléctrico 80L RS 80','Baxi','ACS','265.00','ud'),
  ('BAX-ACS-104','Termoacumulador eléctrico 100L RS 100','Baxi','ACS','305.00','ud'),
  ('BAX-ACS-105','Acumulador ACS 150L indirecto Premier Plus 150','Baxi','ACS','440.00','ud'),
  ('BAX-ACS-106','Acumulador ACS 200L indirecto Premier Plus 200','Baxi','ACS','580.00','ud'),
  ('BAX-BDC-101','Bomba calor aerotermia 5kW Aurea 5kW','Baxi','Bomba de calor','2650.00','ud'),
  ('BAX-BDC-102','Bomba calor aerotermia 8kW Aurea 8kW','Baxi','Bomba de calor','3250.00','ud'),
  ('BAX-BDC-103','Bomba calor aerotermia 12kW Aurea 12kW','Baxi','Bomba de calor','4350.00','ud'),
  ('BAX-CON-101','Termostato WiFi MyBAXI Connect','Baxi','Control','118.00','ud'),
  ('BAX-CON-102','Termostato programable 5+2 días','Baxi','Control','78.00','ud'),
  ('BAX-ACC-101','Kit evacuación coaxial 60/100mm 1m','Baxi','Accesorios','28.00','ud'),
  ('BAX-ACC-102','Kit evacuación separado 80mm 1m','Baxi','Accesorios','42.00','ud'),
  ('BAX-ACC-103','Vaso expansión 10L recambio','Baxi','Accesorios','44.00','ud'),
  ('BAX-ACC-104','Bomba circuladora recambio Duo-tec','Baxi','Accesorios','88.00','ud'),
  ('BAX-ACC-105','Intercambiador primario recambio 24kW','Baxi','Accesorios','128.00','ud')
) AS v(ref, descr, marca, familia, precio, unidad)
WHERE c.supplier_key='baxi'
AND NOT EXISTS (SELECT 1 FROM public.trade_supplier_products p2 WHERE p2.catalog_id=c.id AND p2.ref_proveedor=v.ref);

UPDATE public.trade_supplier_products p
SET search_vector=to_tsvector('spanish', coalesce(p.descripcion,'')||' '||coalesce(p.familia,'')||' '||coalesce(p.marca,''))
FROM public.trade_supplier_catalogs c
WHERE p.catalog_id=c.id AND c.supplier_key='baxi' AND p.search_vector IS NULL;
;
