
INSERT INTO public.trade_supplier_catalogs
  (supplier_key, supplier_name, is_active, margen_pct_default, prioridad, is_custom, acuerdo_estado)
SELECT 'daikin','Daikin',true,28,6,false,'activo'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_supplier_catalogs WHERE supplier_key = 'daikin');

INSERT INTO public.trade_supplier_products (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo)
SELECT c.id, v.ref, v.descr, v.marca, v.familia, v.precio::numeric, v.unidad, true
FROM public.trade_supplier_catalogs c
CROSS JOIN (VALUES
  -- Split 1x1 pared
  ('DAI-SPL-101','Split 1x1 pared 2150 frig/h A++ R32 FTXC25C','Daikin','Split inverter','580.00','ud'),
  ('DAI-SPL-102','Split 1x1 pared 2580 frig/h A++ R32 FTXC35C','Daikin','Split inverter','650.00','ud'),
  ('DAI-SPL-103','Split 1x1 pared 3400 frig/h A++ R32 FTXC50C','Daikin','Split inverter','780.00','ud'),
  ('DAI-SPL-104','Split 1x1 pared 4200 frig/h A++ R32 FTXC60C','Daikin','Split inverter','920.00','ud'),
  ('DAI-SPL-105','Split 1x1 pared 5200 frig/h A+ R32 FTXC71C','Daikin','Split inverter','1080.00','ud'),
  ('DAI-SPL-106','Split 1x1 pared 7000 frig/h A+ R32 FTXC90C','Daikin','Split inverter','1350.00','ud'),
  ('DAI-SPL-107','Split 1x1 Stylish 2150 frig/h A+++ FTXA25CW','Daikin','Split inverter','950.00','ud'),
  ('DAI-SPL-108','Split 1x1 Stylish 3400 frig/h A+++ FTXA50CW','Daikin','Split inverter','1150.00','ud'),
  ('DAI-SPL-109','Split 1x1 Emura 2150 frig/h A+++ FTXJ25MW','Daikin','Split inverter','1100.00','ud'),
  ('DAI-SPL-110','Split 1x1 Emura 3400 frig/h A+++ FTXJ50MW','Daikin','Split inverter','1380.00','ud'),
  -- Multi-split
  ('DAI-MUL-101','Unidad exterior Multi-split 2x1 3.4kW MXM40N','Daikin','Multi-split','850.00','ud'),
  ('DAI-MUL-102','Unidad exterior Multi-split 3x1 5.2kW MXM52N','Daikin','Multi-split','1200.00','ud'),
  ('DAI-MUL-103','Unidad exterior Multi-split 4x1 6.8kW MXM68N','Daikin','Multi-split','1580.00','ud'),
  ('DAI-MUL-104','Unidad interior cassette 2 vías 2.5kW FFTXS25M','Daikin','Multi-split','480.00','ud'),
  ('DAI-MUL-105','Unidad interior cassette 4 vías 4.5kW FFQ45C','Daikin','Multi-split','680.00','ud'),
  ('DAI-MUL-106','Unidad interior conductos 2.5kW FDXS25F','Daikin','Multi-split','520.00','ud'),
  ('DAI-MUL-107','Unidad interior conductos 6kW FDXS60F','Daikin','Multi-split','780.00','ud'),
  -- Bomba de calor aerotermia
  ('DAI-AER-101','Bomba calor aerotermia monobloc 4kW Altherma 3 R','Daikin','Aerotermia','2850.00','ud'),
  ('DAI-AER-102','Bomba calor aerotermia monobloc 8kW Altherma 3 R','Daikin','Aerotermia','3450.00','ud'),
  ('DAI-AER-103','Bomba calor aerotermia monobloc 11kW Altherma 3 R','Daikin','Aerotermia','4200.00','ud'),
  ('DAI-AER-104','Bomba calor aerotermia monobloc 16kW Altherma 3 R','Daikin','Aerotermia','5800.00','ud'),
  ('DAI-AER-105','Acumulador ACS 180L para Altherma','Daikin','Aerotermia','850.00','ud'),
  ('DAI-AER-106','Acumulador ACS 300L para Altherma','Daikin','Aerotermia','1200.00','ud'),
  ('DAI-AER-107','Kit instalación aerotermia monobloc','Daikin','Aerotermia','185.00','ud'),
  -- Cassette y Conductos
  ('DAI-CAS-101','Cassette 4 vías 3.4kW A+ FCQ35F','Daikin','Cassette','780.00','ud'),
  ('DAI-CAS-102','Cassette 4 vías 5kW A+ FCQ50F','Daikin','Cassette','920.00','ud'),
  ('DAI-CAS-103','Cassette 4 vías 6.8kW A+ FCQ68F','Daikin','Cassette','1100.00','ud'),
  ('DAI-CAS-104','Cassette 1 vía 2.5kW A FDKS25E','Daikin','Cassette','620.00','ud'),
  -- Accesorios y Consumibles
  ('DAI-ACC-101','Tubería cobre para split 1/4+1/2 rollo 10m','Daikin','Accesorios','65.00','rollo'),
  ('DAI-ACC-102','Tubería cobre para split 1/4+5/8 rollo 10m','Daikin','Accesorios','78.00','rollo'),
  ('DAI-ACC-103','Aislamiento coquilla 19mm armaflex rollo 2m','Armacell','Accesorios','12.00','ud'),
  ('DAI-ACC-104','Soporte mural unidad exterior aluminio 80kg','Daikin','Accesorios','42.00','ud'),
  ('DAI-ACC-105','Soporte suelo unidad exterior 60kg','Daikin','Accesorios','38.00','ud'),
  ('DAI-ACC-106','Bomba condensados mini 12L/h silenciosa','Aspen','Accesorios','45.00','ud'),
  ('DAI-ACC-107','Mando a distancia universal compatible Daikin','Daikin','Accesorios','28.00','ud'),
  ('DAI-ACC-108','Interfaz WiFi BRP069B41 para Daikin','Daikin','Accesorios','85.00','ud'),
  ('DAI-ACC-109','Gas refrigerante R32 10kg botella','Refcool','Accesorios','125.00','ud'),
  ('DAI-ACC-110','Gas refrigerante R410A 10kg botella','Refcool','Accesorios','115.00','ud'),
  ('DAI-ACC-111','Canaleta PVC split 60x60mm barra 2m blanca','Daikin','Accesorios','8.50','ud'),
  ('DAI-ACC-112','Canaleta PVC split 80x60mm barra 2m blanca','Daikin','Accesorios','10.50','ud'),
  ('DAI-ACC-113','Pasatubos pared 80mm con tapa blanca','Daikin','Accesorios','4.50','ud'),
  ('DAI-ACC-114','Válvula de servicio 1/4 para carga gas','Refcool','Accesorios','18.00','ud'),
  -- VRV / Comercial
  ('DAI-VRV-101','Unidad exterior VRV IV 8HP R410A RXYQ8T','Daikin','VRV','4800.00','ud'),
  ('DAI-VRV-102','Unidad exterior VRV IV 10HP R410A RXYQ10T','Daikin','VRV','5800.00','ud'),
  ('DAI-VRV-103','Unidad interior fancoil pared 2.2kW FXAQ20P','Daikin','VRV','380.00','ud'),
  ('DAI-VRV-104','Unidad interior cassette 4 vías 2.8kW FXZQ25P','Daikin','VRV','520.00','ud')
) AS v(ref, descr, marca, familia, precio, unidad)
WHERE c.supplier_key = 'daikin'
AND NOT EXISTS (
  SELECT 1 FROM public.trade_supplier_products p2
  WHERE p2.catalog_id = c.id AND p2.ref_proveedor = v.ref
);

UPDATE public.trade_supplier_products p
SET search_vector = to_tsvector('spanish',
  coalesce(p.descripcion,'') || ' ' || coalesce(p.familia,'') || ' ' || coalesce(p.marca,''))
FROM public.trade_supplier_catalogs c
WHERE p.catalog_id = c.id AND c.supplier_key = 'daikin' AND p.search_vector IS NULL;
;
