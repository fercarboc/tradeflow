
UPDATE public.trade_supplier_catalogs SET is_active=true, acuerdo_estado='activo' WHERE supplier_key='ariston';

INSERT INTO public.trade_supplier_products (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo)
SELECT c.id, v.ref, v.descr, v.marca, v.familia, v.precio::numeric, v.unidad, true
FROM public.trade_supplier_catalogs c
CROSS JOIN (VALUES
  ('ARI-CAL-101','Caldera condensación mural 24kW Genus One System 24','Ariston','Calderas','710.00','ud'),
  ('ARI-CAL-102','Caldera condensación mural 30kW Genus One System 30','Ariston','Calderas','790.00','ud'),
  ('ARI-CAL-103','Caldera condensación mural 24kW Alteas One Net 24','Ariston','Calderas','920.00','ud'),
  ('ARI-CAL-104','Caldera condensación mural 30kW Alteas One Net 30','Ariston','Calderas','1050.00','ud'),
  ('ARI-CAL-105','Caldera condensación suelo 32kW Genus Premium Net Floor','Ariston','Calderas','2300.00','ud'),
  ('ARI-ACS-101','Termoacumulador eléctrico 50L Velis Evo','Ariston','ACS','280.00','ud'),
  ('ARI-ACS-102','Termoacumulador eléctrico 80L Velis Evo','Ariston','ACS','320.00','ud'),
  ('ARI-ACS-103','Termoacumulador eléctrico 100L Velis Evo Plus WiFi','Ariston','ACS','420.00','ud'),
  ('ARI-ACS-104','Termoacumulador eléctrico 150L Velis Plus WiFi','Ariston','ACS','520.00','ud'),
  ('ARI-ACS-105','Acumulador ACS 120L indirecto SGA 120','Ariston','ACS','390.00','ud'),
  ('ARI-ACS-106','Acumulador ACS 200L indirecto SGA 200','Ariston','ACS','580.00','ud'),
  ('ARI-ACS-107','Calentador instantáneo gas nat. 11L Genus Premium Evo','Ariston','ACS','310.00','ud'),
  ('ARI-BDC-101','Bomba calor aerotermia 6kW Nimbus Compact M NET','Ariston','Bomba de calor','2750.00','ud'),
  ('ARI-BDC-102','Bomba calor aerotermia 8kW Nimbus Compact M NET','Ariston','Bomba de calor','3350.00','ud'),
  ('ARI-BDC-103','Bomba calor aerotermia 11kW Nimbus Plus M NET','Ariston','Bomba de calor','4400.00','ud'),
  ('ARI-BDC-104','Bomba calor aerotermia 16kW Nimbus Plus M NET','Ariston','Bomba de calor','5800.00','ud'),
  ('ARI-CON-101','Termostato WiFi Cube S NET','Ariston','Control','115.00','ud'),
  ('ARI-CON-102','Sonda exterior para Alteas NET','Ariston','Control','42.00','ud'),
  ('ARI-ACC-101','Kit evacuación coaxial 60/100mm 1m','Ariston','Accesorios','30.00','ud'),
  ('ARI-ACC-102','Vaso expansión 8L recambio caldera','Ariston','Accesorios','45.00','ud'),
  ('ARI-ACC-103','Bomba circuladora recambio Genus','Ariston','Accesorios','92.00','ud'),
  ('ARI-ACC-104','Resistencia eléctrica 1500W recambio acumulador','Ariston','Accesorios','38.00','ud'),
  ('ARI-ACC-105','Ánodo magnesio recambio acumulador','Ariston','Accesorios','22.00','ud')
) AS v(ref, descr, marca, familia, precio, unidad)
WHERE c.supplier_key='ariston'
AND NOT EXISTS (SELECT 1 FROM public.trade_supplier_products p2 WHERE p2.catalog_id=c.id AND p2.ref_proveedor=v.ref);

UPDATE public.trade_supplier_products p
SET search_vector=to_tsvector('spanish', coalesce(p.descripcion,'')||' '||coalesce(p.familia,'')||' '||coalesce(p.marca,''))
FROM public.trade_supplier_catalogs c
WHERE p.catalog_id=c.id AND c.supplier_key='ariston' AND p.search_vector IS NULL;
;
