
INSERT INTO public.trade_supplier_products (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo)
SELECT c.id, v.ref, v.descr, v.marca, v.familia, v.precio::numeric, v.unidad, true
FROM public.trade_supplier_catalogs c
CROSS JOIN (VALUES
  -- Suelos
  ('OBR-SUE-101','Baldosa porcelana mate 60x60 gris cemento','Vives','Suelos','18.50','m2'),
  ('OBR-SUE-102','Baldosa porcelana rectificada 60x120 blanco roto','Porcelanosa','Suelos','32.00','m2'),
  ('OBR-SUE-103','Tarima flotante roble natural AC5 8mm','Quick-Step','Suelos','22.00','m2'),
  ('OBR-SUE-104','Tarima flotante nogal oscuro AC4 10mm','Pergo','Suelos','26.50','m2'),
  ('OBR-SUE-105','Parquet madera maciza roble barnizado 15mm','Bauwerk','Suelos','65.00','m2'),
  ('OBR-SUE-106','Suelo vinílico SPC piedra gris 4mm anti-impacto','Wineo','Suelos','19.80','m2'),
  ('OBR-SUE-107','Baldosa antideslizante exterior 40x40 gris','Vives','Suelos','12.50','m2'),
  ('OBR-SUE-108','Microcemento base gris 5kg','Topciment','Suelos','42.00','kg'),
  ('OBR-SUE-109','Rodapié porcelana 8x60 gris cemento','Vives','Suelos','8.50','ml'),
  ('OBR-SUE-110','Perfil de transición aluminio 93cm plata','Presto','Suelos','6.80','ud'),
  ('OBR-SUE-111','Malla niveladora suelos autonivelante 5kg','Mapei','Suelos','18.00','kg'),
  ('OBR-SUE-112','Baldosa hidráulica 20x20 multicolor retro','Cimentiri','Suelos','28.00','m2'),
  ('OBR-SUE-113','Lámina de corcho instalación flotante 2mm rollo 10m2','Amorim','Suelos','15.00','rollo'),
  ('OBR-SUE-114','Encimera silestone blanco zeus 3cm','Silestone','Suelos','185.00','ml'),
  ('OBR-SUE-115','Suelo técnico elevado 60x60 carga 1200kg','Uniflair','Suelos','45.00','m2'),
  -- Revestimientos / Paredes
  ('OBR-PAR-101','Azulejo metro blanco brillante 10x30','Equipe','Revestimientos','18.00','m2'),
  ('OBR-PAR-102','Revestimiento pasta de papel imitación piedra 60x120','Pamesa','Revestimientos','35.00','m2'),
  ('OBR-PAR-103','Panel decorativo PVC mármol blanco 100x250cm','Dumawall','Revestimientos','22.00','ud'),
  ('OBR-PAR-104','Azulejo hidrofugado cocina 20x60 blanco','Roca','Revestimientos','14.50','m2'),
  ('OBR-PAR-105','Papel pintado vinílico efecto ladrillo gris','As-Creation','Revestimientos','18.00','rollo'),
  ('OBR-PAR-106','Placa cartón-yeso 13mm 120x260 estándar','Knauf','Revestimientos','9.50','ud'),
  ('OBR-PAR-107','Placa cartón-yeso hidrófuga 13mm 120x260','Knauf','Revestimientos','11.50','ud'),
  ('OBR-PAR-108','Placa cartón-yeso cortafuego RF60 15mm','Knauf','Revestimientos','14.00','ud'),
  ('OBR-PAR-109','Perfil guía 70mm para pladur 3m','Knauf','Revestimientos','2.80','ud'),
  ('OBR-PAR-110','Perfil montante 70mm para pladur 3m','Knauf','Revestimientos','3.20','ud'),
  ('OBR-PAR-111','Revestimiento cemento decorativo gris oscuro 5kg','Topciment','Revestimientos','38.00','ud'),
  ('OBR-PAR-112','Panel OSB 18mm 120x250cm interior','Egger','Revestimientos','28.00','ud'),
  ('OBR-PAR-113','Mortero cola flexible C2 25kg gris','Mapei','Revestimientos','18.50','saco'),
  ('OBR-PAR-114','Juntas elastoméricas silicona transparente 300ml','Sika','Revestimientos','6.50','ud'),
  ('OBR-PAR-115','Tela de fibrovidrio malla antihumedad 1x50m','Saint-Gobain','Revestimientos','45.00','rollo'),
  -- Ferretería
  ('OBR-FER-101','Tornillo autorroscante cabeza hexagonal 6x60 (100ud)','Fischer','Ferretería','8.50','caja'),
  ('OBR-FER-102','Taco Fisher SX 10x50mm (100ud)','Fischer','Ferretería','9.80','caja'),
  ('OBR-FER-103','Tornillo madera cabeza plana PZ2 4.5x50 (200ud)','Spax','Ferretería','7.20','caja'),
  ('OBR-FER-104','Bisagra cazoleta 35mm cierre suave (10ud)','Blum','Ferretería','18.00','caja'),
  ('OBR-FER-105','Corredera cajón telescópica 45kg 400mm','Blum','Ferretería','14.50','par'),
  ('OBR-FER-106','Ángulo galvanizado 40x40x3mm (50ud)','Pryda','Ferretería','22.00','caja'),
  ('OBR-FER-107','Clavija de ensamblaje 8x35mm (100ud)','Lamello','Ferretería','4.80','caja'),
  ('OBR-FER-108','Perfil protector aristas acero galvanizado 3m','Knauf','Ferretería','3.20','ud'),
  ('OBR-FER-109','Remache pop aluminio 4.8x10mm (250ud)','Gesipa','Ferretería','6.50','caja'),
  ('OBR-FER-110','Varilla roscada M10 1m galvanizada','Hilti','Ferretería','4.20','ud'),
  ('OBR-FER-111','Tuerca hexagonal M10 galvanizada (50ud)','Hilti','Ferretería','3.50','caja'),
  ('OBR-FER-112','Arandela plana M10 galvanizada (100ud)','Hilti','Ferretería','3.80','caja'),
  ('OBR-FER-113','Abrazadera collarin tubo 40mm galvanizada (10ud)','Clamp','Ferretería','5.20','caja'),
  ('OBR-FER-114','Cinta americana 50mm x 10m gris','3M','Ferretería','7.80','ud'),
  ('OBR-FER-115','Silicona neutra blanca 300ml construcción','Sika','Ferretería','4.50','ud'),
  -- Pintura
  ('OBR-PIN-101','Pintura plástica blanca interior 15L','Pladur','Pintura','42.00','cubo'),
  ('OBR-PIN-102','Pintura plástica lavable blanca mate 5L','Reveton','Pintura','18.50','ud'),
  ('OBR-PIN-103','Esmalte sintético satinado blanco 750ml','Titanlux','Pintura','12.00','ud'),
  ('OBR-PIN-104','Barniz madera exterior satinado 750ml','Xylazel','Pintura','14.50','ud'),
  ('OBR-PIN-105','Imprimación universal blanca 750ml','Titanlux','Pintura','10.00','ud'),
  ('OBR-PIN-106','Pintura antihumedad fachadas blanca 15L','Reveton','Pintura','58.00','cubo'),
  ('OBR-PIN-107','Pintura pizarra magnética negra 750ml','Titanlux','Pintura','18.00','ud'),
  ('OBR-PIN-108','Rodillo pintura 23cm fibra corta con mango','Nespoli','Pintura','6.50','ud'),
  ('OBR-PIN-109','Brocha professional 60mm cerda natural','Nespoli','Pintura','5.20','ud'),
  ('OBR-PIN-110','Cinta enmascarar 19mm x 50m','3M','Pintura','4.80','ud'),
  ('OBR-PIN-111','Lija papel grano 80 230x280mm (10ud)','Mirka','Pintura','6.80','caja'),
  ('OBR-PIN-112','Lija papel grano 120 230x280mm (10ud)','Mirka','Pintura','7.20','caja'),
  ('OBR-PIN-113','Bandeja pintura 28cm plástico','Nespoli','Pintura','3.20','ud'),
  ('OBR-PIN-114','Pintura caucho exterior antilluvia 5L gris','Reveton','Pintura','32.00','ud'),
  ('OBR-PIN-115','Spray pintura anticorrosiva negro 400ml','Montana','Pintura','8.50','ud'),
  -- Cubiertas y Tejas
  ('OBR-CUB-101','Teja cerámica curva roja 43x26cm','Tejas Verea','Cubiertas','1.20','ud'),
  ('OBR-CUB-102','Teja plana cerámica 33x22cm roja','Tejas Verea','Cubiertas','0.95','ud'),
  ('OBR-CUB-103','Teja hormigón plana gris oscuro 33x42cm','BMI','Cubiertas','1.45','ud'),
  ('OBR-CUB-104','Membrana impermeabilizante EPDM 1.5mm rollo 10m2','Carlisle','Cubiertas','85.00','rollo'),
  ('OBR-CUB-105','Tela asfáltica LBM 40 FV rollo 10m','Onduline','Cubiertas','48.00','rollo'),
  ('OBR-CUB-106','Canalón aluminio semicircular 125mm barra 3m','Nicoll','Cubiertas','22.00','ud'),
  ('OBR-CUB-107','Bajante PVC 80mm gris barra 4m','Nicoll','Cubiertas','14.50','ud'),
  ('OBR-CUB-108','Gárgola salida agua canalón 80mm aluminio','Nicoll','Cubiertas','6.50','ud'),
  ('OBR-CUB-109','Aireador teja cerámica universal','Tejas Verea','Cubiertas','3.80','ud'),
  ('OBR-CUB-110','Onduline classic verde 950x2000mm','Onduline','Cubiertas','18.00','ud'),
  -- Madera / Estructura
  ('OBR-MAD-101','Viga madera laminada pino 10x10cm barra 4m','Egoin','Madera','38.00','ud'),
  ('OBR-MAD-102','Viga madera laminada pino 12x12cm barra 4m','Egoin','Madera','52.00','ud'),
  ('OBR-MAD-103','Tablero OSB 18mm 120x250cm estructura','Egger','Madera','28.00','ud'),
  ('OBR-MAD-104','Tablero MDF 16mm 120x240cm crudo','Finsa','Madera','22.00','ud'),
  ('OBR-MAD-105','Tabla pino canteado 2.5x10cm barra 4m','Maderas Norte','Madera','6.50','ud'),
  ('OBR-MAD-106','Listón pino cepillado 5x5cm barra 4m','Maderas Norte','Madera','4.80','ud'),
  ('OBR-MAD-107','Contrachapado marino 12mm 120x240cm','Garnica','Madera','35.00','ud'),
  ('OBR-MAD-108','Perfil HEB100 acero laminado barra 6m','Arcelor','Madera','145.00','ud'),
  ('OBR-MAD-109','Perfil IPE120 acero laminado barra 6m','Arcelor','Madera','118.00','ud'),
  ('OBR-MAD-110','Malla electrosoldada 15x15cm 6mm 2x3m','Trefilería','Madera','28.00','ud'),
  -- Antenas y Telecomunicaciones
  ('OBR-ANT-101','Antena TV terrestre exterior UHF LTE 10dB','Televes','Antenas','28.00','ud'),
  ('OBR-ANT-102','Antena TV terrestre exterior UHF 14 elementos','Televes','Antenas','22.00','ud'),
  ('OBR-ANT-103','Amplificador señal TV 20dB TDT/SAT','Alcad','Antenas','45.00','ud'),
  ('OBR-ANT-104','Cable coaxial 75Ohm TV rollo 100m','Televes','Antenas','48.00','rollo'),
  ('OBR-ANT-105','Base antena mástil 40mm tubo 1m','Televes','Antenas','12.50','ud'),
  ('OBR-ANT-106','Toma usuario TV-SAT hembra empotrar blanca','Televes','Antenas','6.50','ud'),
  ('OBR-ANT-107','Distribuidor TV 2 salidas F-F interior','Televes','Antenas','8.80','ud'),
  ('OBR-ANT-108','Plato satélite 60cm con LNB universal','Inverto','Antenas','35.00','ud'),
  -- Cerraduras y Seguridad
  ('OBR-CER-101','Cerradura seguridad 3 puntos embutir madera','Tesa','Cerraduras','65.00','ud'),
  ('OBR-CER-102','Cerradura embutir cilindro 70mm latón','Yale','Cerraduras','42.00','ud'),
  ('OBR-CER-103','Cilindro seguridad 30+30mm anti-bumping','Mul-T-Lock','Cerraduras','55.00','ud'),
  ('OBR-CER-104','Pomo puerta interior latón mate con roseta','Manital','Cerraduras','28.00','ud'),
  ('OBR-CER-105','Manivela puerta aluminio con cerradura','Manital','Cerraduras','35.00','ud'),
  ('OBR-CER-106','Cerrojo doble palomilla 80mm latón','Tesa','Cerraduras','18.00','ud'),
  ('OBR-CER-107','Escudo protector cerradura acero reforzado','Disec','Cerraduras','28.00','ud'),
  ('OBR-CER-108','Bisagra puerta 100x100mm inox 3 piezas','Hettich','Cerraduras','14.50','ud'),
  -- Aislamiento
  ('OBR-AIS-101','Lana mineral 50mm fachada rollo 10m2','Isover','Aislamiento','32.00','rollo'),
  ('OBR-AIS-102','Panel rígido XPS 60mm suelo 1.25x0.6m','Ursa','Aislamiento','14.50','ud'),
  ('OBR-AIS-103','Panel EPS 40mm fachada 1x0.5m','Knauf','Aislamiento','8.50','ud'),
  ('OBR-AIS-104','Espuma PU en pistola 750ml','Sika','Aislamiento','9.80','ud'),
  ('OBR-AIS-105','Membrana freno vapor 200 micras rollo 50m2','Isover','Aislamiento','48.00','rollo')
) AS v(ref, descr, marca, familia, precio, unidad)
WHERE c.supplier_key = 'obramat'
AND NOT EXISTS (
  SELECT 1 FROM public.trade_supplier_products p2
  WHERE p2.catalog_id = c.id AND p2.ref_proveedor = v.ref
);

UPDATE public.trade_supplier_products p
SET search_vector = to_tsvector('spanish',
  coalesce(p.descripcion,'') || ' ' || coalesce(p.familia,'') || ' ' || coalesce(p.marca,''))
FROM public.trade_supplier_catalogs c
WHERE p.catalog_id = c.id AND c.supplier_key = 'obramat' AND p.search_vector IS NULL;
;
