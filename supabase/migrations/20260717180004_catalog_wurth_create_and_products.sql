
INSERT INTO public.trade_supplier_catalogs
  (supplier_key, supplier_name, is_active, margen_pct_default, prioridad, is_custom, acuerdo_estado)
SELECT 'wurth','Würth',true,30,5,false,'activo'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_supplier_catalogs WHERE supplier_key = 'wurth');

INSERT INTO public.trade_supplier_products (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo)
SELECT c.id, v.ref, v.descr, v.marca, v.familia, v.precio::numeric, v.unidad, true
FROM public.trade_supplier_catalogs c
CROSS JOIN (VALUES
  ('WUR-TOR-101','Tornillo tirafondo TX 4x40 zincado (200ud)','Würth','Tornillería','8.50','caja'),
  ('WUR-TOR-102','Tornillo tirafondo TX 5x60 zincado (200ud)','Würth','Tornillería','10.50','caja'),
  ('WUR-TOR-103','Tornillo tirafondo TX 6x80 zincado (100ud)','Würth','Tornillería','9.80','caja'),
  ('WUR-TOR-104','Tornillo aglomerado PZ2 4x50 (200ud)','Würth','Tornillería','6.50','caja'),
  ('WUR-TOR-105','Tornillo autotaladrante 4.2x13 (500ud)','Würth','Tornillería','7.20','caja'),
  ('WUR-TOR-106','Tornillo hexagonal M8x50 galvanizado (50ud)','Würth','Tornillería','8.80','caja'),
  ('WUR-TOR-107','Taco nylon S8 con tornillo (100ud)','Würth','Tornillería','9.20','caja'),
  ('WUR-TOR-108','Taco químico R-KD M10 385ml','Würth','Tornillería','18.50','ud'),
  ('WUR-TOR-109','Varilla roscada M10 x 1m galvanizada (10ud)','Würth','Tornillería','22.00','caja'),
  ('WUR-TOR-110','Espárrago métrico M8 x 100mm (25ud)','Würth','Tornillería','6.80','caja'),
  ('WUR-TOR-111','Tornillo tirafondo TX 3.5x35 (200ud)','Würth','Tornillería','5.80','caja'),
  ('WUR-TOR-112','Remache pop aluminio 4x10 (250ud)','Würth','Tornillería','6.20','caja'),
  ('WUR-TOR-113','Tornillo cartón-yeso TN 3.5x35 (500ud)','Würth','Tornillería','7.50','caja'),
  ('WUR-FIJ-101','Taco de golpe nylon 6mm (100ud)','Würth','Fijaciones','4.50','caja'),
  ('WUR-FIJ-102','Taco expansión metálico M8 (50ud)','Würth','Fijaciones','12.00','caja'),
  ('WUR-FIJ-103','Anclaje químico Injection 300ml','Würth','Fijaciones','28.00','ud'),
  ('WUR-FIJ-104','Gancho autoenroscable 5x40mm (50ud)','Würth','Fijaciones','9.50','caja'),
  ('WUR-FIJ-105','Cáncamo ojo M8 galvanizado (25ud)','Würth','Fijaciones','8.80','caja'),
  ('WUR-FIJ-106','Abrazadera isofónica tubo 32mm (10ud)','Würth','Fijaciones','7.20','caja'),
  ('WUR-FIJ-107','Abrazadera metálica tubo 50mm (10ud)','Würth','Fijaciones','8.50','caja'),
  ('WUR-FIJ-108','Perfil omega 30x30 acero galvanizado 2m','Würth','Fijaciones','4.80','ud'),
  ('WUR-FIJ-109','Banda antisísmica 100mm rollo 10m','Würth','Fijaciones','18.00','rollo'),
  ('WUR-FIJ-110','Cinta doble cara montaje fuerte 19mm x 5m','Würth','Fijaciones','6.50','ud'),
  ('WUR-QUI-101','Spray lubricante multiuso 500ml','Würth','Química','8.50','ud'),
  ('WUR-QUI-102','Grasa de litio multiuso 500g','Würth','Química','9.80','ud'),
  ('WUR-QUI-103','Limpiador desengrasante rápido spray 500ml','Würth','Química','7.20','ud'),
  ('WUR-QUI-104','Sellador silicona neutra blanca 310ml','Würth','Química','4.80','ud'),
  ('WUR-QUI-105','Sellador silicona sanitaria blanca 310ml','Würth','Química','5.20','ud'),
  ('WUR-QUI-106','Espuma PU pistola poliuretano 750ml','Würth','Química','9.50','ud'),
  ('WUR-QUI-107','Adhesivo de montaje MS Polymer 290ml','Würth','Química','7.80','ud'),
  ('WUR-QUI-108','Cinta americana 50mm x 25m gris','Würth','Química','8.20','ud'),
  ('WUR-QUI-109','Spray pintura antioxidante negro 400ml','Würth','Química','6.50','ud'),
  ('WUR-QUI-110','Pegamento contacto gel 400g','Würth','Química','12.50','ud'),
  ('WUR-QUI-111','Limpiador contactos eléctricos spray 400ml','Würth','Química','9.80','ud'),
  ('WUR-QUI-112','Spray zinc galvafroid 400ml anticorrosión','Würth','Química','11.50','ud'),
  ('WUR-QUI-113','Cinta PTFE fontanería 19mm x 50m (10ud)','Würth','Química','9.20','caja'),
  ('WUR-HER-101','Nivel aluminio 60cm con 3 burbujas','Würth','Herramienta','18.00','ud'),
  ('WUR-HER-102','Nivel aluminio 120cm professional','Würth','Herramienta','28.00','ud'),
  ('WUR-HER-103','Juego llaves combinadas 8-22mm 12 piezas','Würth','Herramienta','45.00','ud'),
  ('WUR-HER-104','Juego llaves torx T10-T50 8 piezas','Würth','Herramienta','22.00','ud'),
  ('WUR-HER-105','Destornillador plano/PZ set 6 piezas','Würth','Herramienta','18.50','ud'),
  ('WUR-HER-106','Alicate universal 200mm mango bimaterial','Würth','Herramienta','14.50','ud'),
  ('WUR-HER-107','Alicate pelacables automático 0.5-6mm','Würth','Herramienta','28.00','ud'),
  ('WUR-HER-108','Cúter profesional 18mm con 10 hojas extra','Würth','Herramienta','12.00','ud'),
  ('WUR-HER-109','Cinta métrica 5m x 25mm automática','Würth','Herramienta','8.50','ud'),
  ('WUR-HER-110','Martillo carpintero 500g mango fibra','Würth','Herramienta','22.00','ud'),
  ('WUR-HER-111','Llave inglesa ajustable 250mm','Würth','Herramienta','18.00','ud'),
  ('WUR-HER-112','Arco de sierra y 5 hojas bimetal','Würth','Herramienta','15.00','ud'),
  ('WUR-HER-113','Pistola calafateado professional 310ml','Würth','Herramienta','12.00','ud'),
  ('WUR-EPI-101','Guantes nitrilo desechables talla M (100ud)','Würth','EPIs','12.00','caja'),
  ('WUR-EPI-102','Guantes nitrilo desechables talla L (100ud)','Würth','EPIs','12.00','caja'),
  ('WUR-EPI-103','Guantes cuero trabajo talla 9','Würth','EPIs','8.50','ud'),
  ('WUR-EPI-104','Gafas protección transparentes anti-impacto','Würth','EPIs','4.80','ud'),
  ('WUR-EPI-105','Mascarilla FFP2 sin válvula (5ud)','Würth','EPIs','6.50','caja'),
  ('WUR-EPI-106','Mascarilla FFP3 con válvula (5ud)','Würth','EPIs','12.00','caja'),
  ('WUR-EPI-107','Casco protección blanco ajustable','Würth','EPIs','8.50','ud'),
  ('WUR-EPI-108','Tapones oídos espuma con cordón (50 pares)','Würth','EPIs','9.50','caja'),
  ('WUR-EPI-109','Rodilleras trabajo espuma ergonómica','Würth','EPIs','14.50','ud'),
  ('WUR-EPI-110','Cinturón portaherramientas con 10 bolsillos','Würth','EPIs','28.00','ud'),
  ('WUR-ABR-101','Disco corte metal 125x1mm (25ud)','Würth','Abrasivos','18.50','caja'),
  ('WUR-ABR-102','Disco corte inox 125x1mm (25ud)','Würth','Abrasivos','22.00','caja'),
  ('WUR-ABR-103','Disco amolado metal 125x6mm (10ud)','Würth','Abrasivos','14.50','caja'),
  ('WUR-ABR-104','Disco diamante segmentado 125mm hormigón','Würth','Abrasivos','18.00','ud'),
  ('WUR-ABR-105','Lija orbital 125mm grano 80 (50ud)','Würth','Abrasivos','14.00','caja'),
  ('WUR-ABR-106','Lija orbital 125mm grano 120 (50ud)','Würth','Abrasivos','14.00','caja'),
  ('WUR-ABR-107','Disco fibra 125mm grano 24 acero','Würth','Abrasivos','4.50','ud'),
  ('WUR-ABR-108','Corona bimetálica 68mm madera y plástico','Würth','Abrasivos','18.00','ud'),
  ('WUR-ABR-109','Broca HSS madera y metal set 19 piezas 1-10mm','Würth','Abrasivos','22.00','ud'),
  ('WUR-ABR-110','Broca SDS-Plus 10x160mm hormigón','Würth','Abrasivos','8.50','ud'),
  ('WUR-ELE-101','Regleta conexión 5 bornes 20A (10ud)','Würth','Electricidad','6.50','caja'),
  ('WUR-ELE-102','Cinta aislante PVC negra 19mm x 20m','Würth','Electricidad','2.80','ud'),
  ('WUR-ELE-103','Brida nylon negra 4.8x368mm (100ud)','Würth','Electricidad','5.50','caja'),
  ('WUR-ELE-104','Brida nylon blanca 3.6x140mm (100ud)','Würth','Electricidad','3.80','caja'),
  ('WUR-ELE-105','Conector Wago 5 hilos 2.5mm (25ud)','Würth','Electricidad','9.50','caja'),
  ('WUR-ELE-106','Conector Wago 3 hilos 2.5mm (50ud)','Würth','Electricidad','12.00','caja'),
  ('WUR-ELE-107','Terminal punta aguja 1.5mm (100ud)','Würth','Electricidad','4.50','caja'),
  ('WUR-ELE-108','Terminal ojo M6 amarillo (100ud)','Würth','Electricidad','5.20','caja'),
  ('WUR-FON-101','Cinta selladora PTFE profesional 25mm x 50m','Würth','Fontanería','8.50','ud'),
  ('WUR-FON-102','Sellador hilo cáñamo 100g','Würth','Fontanería','6.80','ud'),
  ('WUR-FON-103','Pasta selladora tuberías gas y agua 350g','Würth','Fontanería','12.00','ud'),
  ('WUR-FON-104','Llave grifo tubo 10 pulgadas','Würth','Fontanería','18.00','ud'),
  ('WUR-FON-105','Llave inglesa ajustable 24 tuberías','Würth','Fontanería','22.00','ud'),
  ('WUR-ILU-101','Linterna LED recargable 800 lm','Würth','Iluminación','28.00','ud'),
  ('WUR-ILU-102','Lámpara trabajo LED portátil 20W 2000 lm','Würth','Iluminación','45.00','ud'),
  ('WUR-ILU-103','Linterna frontal LED 300 lm recargable USB','Würth','Iluminación','22.00','ud')
) AS v(ref, descr, marca, familia, precio, unidad)
WHERE c.supplier_key = 'wurth'
AND NOT EXISTS (
  SELECT 1 FROM public.trade_supplier_products p2
  WHERE p2.catalog_id = c.id AND p2.ref_proveedor = v.ref
);

UPDATE public.trade_supplier_products p
SET search_vector = to_tsvector('spanish',
  coalesce(p.descripcion,'') || ' ' || coalesce(p.familia,'') || ' ' || coalesce(p.marca,''))
FROM public.trade_supplier_catalogs c
WHERE p.catalog_id = c.id AND c.supplier_key = 'wurth' AND p.search_vector IS NULL;
;
