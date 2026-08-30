
-- Activar Sonepar
UPDATE public.trade_supplier_catalogs
SET is_active = true, acuerdo_estado = 'activo'
WHERE supplier_key = 'sonepar';

-- Insertar productos Sonepar
INSERT INTO public.trade_supplier_products (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo)
SELECT c.id, v.ref, v.descr, v.marca, v.familia, v.precio::numeric, v.unidad, true
FROM public.trade_supplier_catalogs c
CROSS JOIN (VALUES
  -- Cables
  ('SON-CAB-101','Cable unipolar 1.5mm2 H07V-K azul rollo 100m','Prysmian','Cables','28.00','rollo'),
  ('SON-CAB-102','Cable unipolar 2.5mm2 H07V-K negro rollo 100m','Prysmian','Cables','42.00','rollo'),
  ('SON-CAB-103','Cable unipolar 4mm2 H07V-K marrón rollo 100m','Prysmian','Cables','65.00','rollo'),
  ('SON-CAB-104','Cable unipolar 6mm2 H07V-K negro rollo 100m','Prysmian','Cables','95.00','rollo'),
  ('SON-CAB-105','Cable manguera 3x1.5mm2 H05VV-F blanco 100m','Prysmian','Cables','68.00','rollo'),
  ('SON-CAB-106','Cable manguera 3x2.5mm2 H05VV-F gris 100m','Prysmian','Cables','98.00','rollo'),
  ('SON-CAB-107','Cable manguera 5x2.5mm2 H05VV-F gris 100m','Prysmian','Cables','145.00','rollo'),
  ('SON-CAB-108','Cable apantallado 2x0.75mm2 control 100m','Belden','Cables','85.00','rollo'),
  ('SON-CAB-109','Cable RJ45 Cat6 UTP 305m azul bobina','Panduit','Cables','185.00','bobina'),
  ('SON-CAB-110','Cable fibra óptica monomodo OS2 4FO 200m','Draka','Cables','145.00','bobina'),
  ('SON-CAB-111','Cable libre halógenos 3G2.5mm2 FROR 100m','Prysmian','Cables','125.00','rollo'),
  ('SON-CAB-112','Cable solar 6mm2 rojo 100m resistente UV','Topsolar','Cables','98.00','rollo'),
  ('SON-CAB-113','Cable unipolar 10mm2 H07V-K negro rollo 100m','Prysmian','Cables','155.00','rollo'),
  ('SON-CAB-114','Cable manguera 2x1.5mm2 blanco 100m','Prysmian','Cables','52.00','rollo'),
  ('SON-CAB-115','Cable unipolar 16mm2 negro rollo 50m','Prysmian','Cables','148.00','rollo'),
  -- Mecanismos
  ('SON-MEC-101','Interruptor 10A 250V blanco empotrar','Schneider','Mecanismos','5.80','ud'),
  ('SON-MEC-102','Conmutador 10A 250V blanco empotrar','Schneider','Mecanismos','6.50','ud'),
  ('SON-MEC-103','Base enchufe schuko 16A 250V blanco','Schneider','Mecanismos','6.80','ud'),
  ('SON-MEC-104','Base enchufe 2P+T 16A con tapa protección blanca','Schneider','Mecanismos','8.50','ud'),
  ('SON-MEC-105','Pulsador 10A timbre blanco empotrar','Schneider','Mecanismos','5.20','ud'),
  ('SON-MEC-106','Regulador de luz LED 0-100W blanco','Schneider','Mecanismos','28.00','ud'),
  ('SON-MEC-107','Toma RJ45 Cat6 empotrar blanca con marco','Schneider','Mecanismos','12.50','ud'),
  ('SON-MEC-108','Toma TV-SAT hembra empotrar blanca','Schneider','Mecanismos','8.80','ud'),
  ('SON-MEC-109','Marco 1 elemento blanco','Schneider','Mecanismos','2.80','ud'),
  ('SON-MEC-110','Marco 2 elementos blanco','Schneider','Mecanismos','4.20','ud'),
  ('SON-MEC-111','Marco 3 elementos blanco','Schneider','Mecanismos','5.50','ud'),
  ('SON-MEC-112','Interruptor diferencial 2P 25A 30mA AC','Schneider','Mecanismos','38.00','ud'),
  ('SON-MEC-113','Telerruptor 16A 230V 2NA','Schneider','Mecanismos','22.00','ud'),
  ('SON-MEC-114','Minutero escalera 10A 230V empotrar','Schneider','Mecanismos','18.00','ud'),
  ('SON-MEC-115','Base industrial 3P+N+T 32A 400V IP44','Legrand','Mecanismos','28.00','ud'),
  -- Protecciones
  ('SON-PRO-101','PIA 1P 10A curva C 6kA','Schneider','Protecciones','12.50','ud'),
  ('SON-PRO-102','PIA 1P 16A curva C 6kA','Schneider','Protecciones','12.50','ud'),
  ('SON-PRO-103','PIA 1P 20A curva C 6kA','Schneider','Protecciones','13.00','ud'),
  ('SON-PRO-104','PIA 2P 25A curva C 6kA','Schneider','Protecciones','22.00','ud'),
  ('SON-PRO-105','PIA 2P 40A curva C 6kA','Schneider','Protecciones','28.00','ud'),
  ('SON-PRO-106','PIA 3P 32A curva C 6kA','Schneider','Protecciones','35.00','ud'),
  ('SON-PRO-107','PIA 4P 63A curva C 10kA','Schneider','Protecciones','68.00','ud'),
  ('SON-PRO-108','Diferencial 2P 40A 30mA tipo AC','Schneider','Protecciones','45.00','ud'),
  ('SON-PRO-109','Diferencial 4P 40A 30mA tipo AC','Schneider','Protecciones','85.00','ud'),
  ('SON-PRO-110','Diferencial 4P 63A 300mA tipo AC','Schneider','Protecciones','98.00','ud'),
  ('SON-PRO-111','Limitador de sobretensión 1P+N clase II','Schneider','Protecciones','45.00','ud'),
  ('SON-PRO-112','IGA 2P 40A 6kA corte general','Schneider','Protecciones','32.00','ud'),
  ('SON-PRO-113','Fusible NH00 160A 500V gG','Siemens','Protecciones','8.50','ud'),
  ('SON-PRO-114','Portafusibles NH00 3P 160A','Siemens','Protecciones','22.00','ud'),
  ('SON-PRO-115','Relé térmico 9-13A regulable','Schneider','Protecciones','28.00','ud'),
  -- Luminaria
  ('SON-LUM-101','Downlight LED empotrar 9W 4000K blanco','Philips','Luminaria','18.00','ud'),
  ('SON-LUM-102','Downlight LED empotrar 18W 4000K blanco','Philips','Luminaria','28.00','ud'),
  ('SON-LUM-103','Panel LED 60x60 40W 4000K blanco','Philips','Luminaria','45.00','ud'),
  ('SON-LUM-104','Regleta LED 120cm 36W 4000K','Philips','Luminaria','38.00','ud'),
  ('SON-LUM-105','Aplique exterior LED 12W 4000K IP65','Osram','Luminaria','32.00','ud'),
  ('SON-LUM-106','Foco carril LED 30W 3000K negro','GreenIQ','Luminaria','42.00','ud'),
  ('SON-LUM-107','Proyector LED exterior 50W 6000K IP65','Ledvance','Luminaria','65.00','ud'),
  ('SON-LUM-108','Lámpara LED E27 10W 840 lm 4000K','Osram','Luminaria','4.50','ud'),
  ('SON-LUM-109','Tubo LED T8 18W 120cm 4000K','Philips','Luminaria','8.50','ud'),
  ('SON-LUM-110','Luminaria emergencia 1h 100 lúmenes','Legrand','Luminaria','28.00','ud'),
  ('SON-LUM-111','Sensor movimiento PIR techo 360° 1200W','Schneider','Luminaria','22.00','ud'),
  ('SON-LUM-112','Tira LED 24V 14W/m 4000K 5m IP20','Osram','Luminaria','45.00','ud'),
  -- Canalizaciones
  ('SON-CAN-101','Tubo corrugado doble pared DN50 rollo 50m','Aiscan','Canalizaciones','38.00','rollo'),
  ('SON-CAN-102','Tubo corrugado doble pared DN63 rollo 50m','Aiscan','Canalizaciones','52.00','rollo'),
  ('SON-CAN-103','Tubo rígido PVC 20mm barra 3m','Aiscan','Canalizaciones','2.80','ud'),
  ('SON-CAN-104','Tubo rígido PVC 25mm barra 3m','Aiscan','Canalizaciones','3.50','ud'),
  ('SON-CAN-105','Tubo rígido PVC 32mm barra 3m','Aiscan','Canalizaciones','4.80','ud'),
  ('SON-CAN-106','Canal PVC 40x25mm blanco barra 2m','Rehau','Canalizaciones','5.20','ud'),
  ('SON-CAN-107','Canal PVC 60x40mm blanco barra 2m','Rehau','Canalizaciones','7.50','ud'),
  ('SON-CAN-108','Canal PVC 100x60mm blanco barra 2m','Rehau','Canalizaciones','12.00','ud'),
  ('SON-CAN-109','Caja empotrar 1 mecanismo 65x65mm','Legrand','Canalizaciones','1.80','ud'),
  ('SON-CAN-110','Caja empotrar 2 mecanismos 65x120mm','Legrand','Canalizaciones','2.50','ud'),
  ('SON-CAN-111','Caja de derivación estanca IP65 100x100mm','Legrand','Canalizaciones','6.80','ud'),
  ('SON-CAN-112','Bandeja perforada 100mm galvanizada 3m','Pemsa','Canalizaciones','18.00','ud'),
  ('SON-CAN-113','Bandeja perforada 200mm galvanizada 3m','Pemsa','Canalizaciones','28.00','ud'),
  -- Cuadros
  ('SON-CUA-101','Caja empotrar ICP-M 4 módulos','Schneider','Cuadros','12.00','ud'),
  ('SON-CUA-102','Cuadro distribución superficie 24 módulos IP40','Schneider','Cuadros','38.00','ud'),
  ('SON-CUA-103','Cuadro distribución empotrar 18 módulos','Schneider','Cuadros','28.00','ud'),
  ('SON-CUA-104','Armario metal puerta opaca 400x600x200mm','Schneider','Cuadros','95.00','ud'),
  ('SON-CUA-105','Embarrado cobre 3P+N 63A para cuadro','Schneider','Cuadros','18.50','ud'),
  ('SON-CUA-106','Peine distribución 3P 63A 12 módulos','Schneider','Cuadros','22.00','ud')
) AS v(ref, descr, marca, familia, precio, unidad)
WHERE c.supplier_key = 'sonepar'
AND NOT EXISTS (
  SELECT 1 FROM public.trade_supplier_products p2
  WHERE p2.catalog_id = c.id AND p2.ref_proveedor = v.ref
);

UPDATE public.trade_supplier_products p
SET search_vector = to_tsvector('spanish',
  coalesce(p.descripcion,'') || ' ' || coalesce(p.familia,'') || ' ' || coalesce(p.marca,''))
FROM public.trade_supplier_catalogs c
WHERE p.catalog_id = c.id AND c.supplier_key = 'sonepar' AND p.search_vector IS NULL;
;
