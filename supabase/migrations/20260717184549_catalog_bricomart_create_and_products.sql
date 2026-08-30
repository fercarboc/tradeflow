
INSERT INTO public.trade_supplier_catalogs
  (supplier_key, supplier_name, is_active, margen_pct_default, prioridad, is_custom, acuerdo_estado)
SELECT 'bricomart','Bricomart Pro',true,22,8,false,'activo'
WHERE NOT EXISTS (SELECT 1 FROM public.trade_supplier_catalogs WHERE supplier_key = 'bricomart');

INSERT INTO public.trade_supplier_products (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo)
SELECT c.id, v.ref, v.descr, v.marca, v.familia, v.precio::numeric, v.unidad, true
FROM public.trade_supplier_catalogs c
CROSS JOIN (VALUES
  -- Materiales construcción base
  ('BRI-CON-101','Cemento Portland CEM II 42.5R saco 25kg','Lafarge','Construcción','5.80','saco'),
  ('BRI-CON-102','Cemento Portland CEM II 42.5R palet 56 sacos','Lafarge','Construcción','290.00','palet'),
  ('BRI-CON-103','Arena lavada fina saco 25kg','Holcim','Construcción','3.20','saco'),
  ('BRI-CON-104','Gravilla 6-12mm saco 25kg','Holcim','Construcción','3.50','saco'),
  ('BRI-CON-105','Mortero cola exterior C1 25kg gris','Weber','Construcción','8.50','saco'),
  ('BRI-CON-106','Mortero cola flexible C2 25kg gris','Weber','Construcción','16.50','saco'),
  ('BRI-CON-107','Yeso proyectado saco 25kg','Placo','Construcción','6.80','saco'),
  ('BRI-CON-108','Cal hidráulica NHL5 saco 25kg','Strasservil','Construcción','9.50','saco'),
  ('BRI-CON-109','Bloque hormigón 40x20x20cm 10ud','Ulma','Construcción','12.50','ud'),
  ('BRI-CON-110','Ladrillo perforado 25x12x9cm palet 500ud','Hispalyt','Construcción','185.00','palet'),
  ('BRI-CON-111','Ladrillo hueco doble 25x12x7cm palet 500ud','Hispalyt','Construcción','165.00','palet'),
  ('BRI-CON-112','Adoquín hormigón 20x10x6cm gris palet','Prefabricados','Construcción','145.00','palet'),
  ('BRI-CON-113','Mortero autonivelante 25kg suelo','Weber','Construcción','14.50','saco'),
  ('BRI-CON-114','Impermeabilizante monocomponente 25kg','Mapei','Construcción','38.00','cubo'),
  -- Forjado y Estructura
  ('BRI-EST-101','Vigueta hormigón pretensado 4m','Prefabricados','Estructura','18.50','ud'),
  ('BRI-EST-102','Vigueta hormigón pretensado 5m','Prefabricados','Estructura','23.00','ud'),
  ('BRI-EST-103','Bovedilla hormigón 60x25x20cm','Prefabricados','Estructura','2.80','ud'),
  ('BRI-EST-104','Malla electrosoldada B500T 15x15x6mm 2.2x5m','Arcelor','Estructura','28.00','ud'),
  ('BRI-EST-105','Hierro corrugado B500S 12mm barra 12m','Arcelor','Estructura','18.50','ud'),
  ('BRI-EST-106','Hierro corrugado B500S 16mm barra 12m','Arcelor','Estructura','32.00','ud'),
  ('BRI-EST-107','Pilar metálico HEB120 barra 6m','Arcelor','Estructura','185.00','ud'),
  ('BRI-EST-108','Correa metálica Z200 barra 6m galvanizada','Arcelor','Estructura','45.00','ud'),
  -- Herramienta eléctrica profesional
  ('BRI-HER-101','Taladro percutor 13mm 850W con maletín','Makita','Herramienta eléctrica','88.00','ud'),
  ('BRI-HER-102','Martillo SDS-Plus 5J 800W','Makita','Herramienta eléctrica','145.00','ud'),
  ('BRI-HER-103','Amoladora angular 125mm 1400W','DeWalt','Herramienta eléctrica','98.00','ud'),
  ('BRI-HER-104','Amoladora angular 230mm 2200W profesional','DeWalt','Herramienta eléctrica','185.00','ud'),
  ('BRI-HER-105','Sierra circular 185mm 1200W con guía','Makita','Herramienta eléctrica','128.00','ud'),
  ('BRI-HER-106','Lijadora orbital 125mm 400W con bolsa','DeWalt','Herramienta eléctrica','78.00','ud'),
  ('BRI-HER-107','Atornillador de impacto 18V 4Ah + 2 baterías','Makita','Herramienta eléctrica','185.00','ud'),
  ('BRI-HER-108','Taladro atornillador 18V 5Ah 2 baterías','DeWalt','Herramienta eléctrica','195.00','ud'),
  ('BRI-HER-109','Sierra de calar 800W 30mm madera','Bosch','Herramienta eléctrica','88.00','ud'),
  ('BRI-HER-110','Nivel láser autonivelante 3 líneas 360°','Bosch','Herramienta eléctrica','145.00','ud'),
  -- Fontanería básica
  ('BRI-FON-101','Llave de paso empotrar 1/2 latón','Roca','Fontanería','12.50','ud'),
  ('BRI-FON-102','Llave de paso empotrar 3/4 latón','Roca','Fontanería','16.00','ud'),
  ('BRI-FON-103','Contador agua 1/2 clase C 15mm','Zenner','Fontanería','48.00','ud'),
  ('BRI-FON-104','Tubo multicapa 16x2mm rollo 100m','Uponor','Fontanería','145.00','rollo'),
  ('BRI-FON-105','Colector 3 salidas 3/4 latón','Giacomini','Fontanería','38.00','ud'),
  -- Electricidad básica
  ('BRI-ELE-101','Cable manguera 3x1.5mm2 blanco 100m','Prysmian','Electricidad','68.00','rollo'),
  ('BRI-ELE-102','Cable manguera 3x2.5mm2 gris 100m','Prysmian','Electricidad','98.00','rollo'),
  ('BRI-ELE-103','Cuadro distribución superficie 24 módulos','Hager','Electricidad','42.00','ud'),
  ('BRI-ELE-104','PIA 1P 16A curva C 6kA Hager','Hager','Electricidad','12.00','ud'),
  ('BRI-ELE-105','Diferencial 2P 40A 30mA Hager','Hager','Electricidad','42.00','ud'),
  -- Reformas interiores
  ('BRI-REF-101','Placa cartón-yeso 13mm 120x260 estándar','Placo','Pladur','9.20','ud'),
  ('BRI-REF-102','Placa cartón-yeso hidrófuga 12.5mm 120x260','Placo','Pladur','11.00','ud'),
  ('BRI-REF-103','Perfil guía 48mm 3m pladur','Placo','Pladur','2.60','ud'),
  ('BRI-REF-104','Perfil montante 48mm 3m pladur','Placo','Pladur','2.90','ud'),
  ('BRI-REF-105','Masilla enlucido fino 4kg Knauf','Knauf','Pladur','8.50','ud'),
  ('BRI-REF-106','Panel aislante EPS 60mm 1x0.5m fachada','Knauf','Aislamiento','9.80','ud'),
  ('BRI-REF-107','Lana mineral 45mm tabique rollo 10m2','Isover','Aislamiento','28.00','rollo'),
  ('BRI-REF-108','Panel XPS 50mm 1.25x0.6m suelo','Ursa','Aislamiento','12.50','ud'),
  -- Pavimentos y revestimientos
  ('BRI-PAV-101','Baldosa porcelana 60x60 gris mate m2','Pamesa','Pavimento','14.50','m2'),
  ('BRI-PAV-102','Baldosa porcelana 80x80 blanco rectificado m2','Pamesa','Pavimento','22.00','m2'),
  ('BRI-PAV-103','Tarima laminada roble 8mm AC4 paq 2.22m2','Quick-Step','Pavimento','18.00','m2'),
  ('BRI-PAV-104','Suelo vinílico PVC click 4mm gris paq 2m2','Wineo','Pavimento','16.50','m2'),
  ('BRI-PAV-105','Rodapié MDF lacado blanco 8x70mm barra 2.4m','Perfiles','Pavimento','4.20','ud'),
  -- Pinturas
  ('BRI-PIN-101','Pintura plástica interior blanca mate 15L','Reveton','Pintura','38.00','cubo'),
  ('BRI-PIN-102','Pintura plástica lavable 5L blanca','Reveton','Pintura','16.50','ud'),
  ('BRI-PIN-103','Pintura antihumedad fachada 5L blanca','Reveton','Pintura','28.00','ud'),
  ('BRI-PIN-104','Esmalte satinado madera/metal blanco 750ml','Titanlux','Pintura','11.50','ud'),
  ('BRI-PIN-105','Rodillo fibra media 23cm con mango','Nespoli','Pintura','5.80','ud'),
  -- Cubiertas y tejados
  ('BRI-CUB-101','Teja cerámica curva roja 25ud','Tejas Verea','Cubierta','28.00','ud'),
  ('BRI-CUB-102','Membrana impermeabilizante EPDM 1.2mm rollo 10m2','Firestone','Cubierta','78.00','rollo'),
  ('BRI-CUB-103','Tela asfáltica LBM 40 FV 10m','Onduline','Cubierta','45.00','rollo'),
  ('BRI-CUB-104','Canalón aluminio 125mm 3m natural','Nicoll','Cubierta','22.00','ud'),
  ('BRI-CUB-105','Bajante PVC 100mm 4m gris','Nicoll','Cubierta','18.50','ud')
) AS v(ref, descr, marca, familia, precio, unidad)
WHERE c.supplier_key = 'bricomart'
AND NOT EXISTS (
  SELECT 1 FROM public.trade_supplier_products p2
  WHERE p2.catalog_id = c.id AND p2.ref_proveedor = v.ref
);

UPDATE public.trade_supplier_products p
SET search_vector = to_tsvector('spanish',
  coalesce(p.descripcion,'') || ' ' || coalesce(p.familia,'') || ' ' || coalesce(p.marca,''))
FROM public.trade_supplier_catalogs c
WHERE p.catalog_id = c.id AND c.supplier_key = 'bricomart' AND p.search_vector IS NULL;
;
