
-- Activar Novelec
UPDATE public.trade_supplier_catalogs
SET is_active = true, acuerdo_estado = 'activo'
WHERE supplier_key = 'novelec';

-- Insertar productos Novelec
INSERT INTO public.trade_supplier_products (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo)
SELECT c.id, v.ref, v.descr, v.marca, v.familia, v.precio::numeric, v.unidad, true
FROM public.trade_supplier_catalogs c
CROSS JOIN (VALUES
  -- Cables
  ('NOV-CAB-101','Cable unipolar 1.5mm2 H07V-K azul rollo 100m','Nexans','Cables','27.00','rollo'),
  ('NOV-CAB-102','Cable unipolar 2.5mm2 H07V-K negro rollo 100m','Nexans','Cables','40.00','rollo'),
  ('NOV-CAB-103','Cable unipolar 4mm2 H07V-K marrón rollo 100m','Nexans','Cables','62.00','rollo'),
  ('NOV-CAB-104','Cable unipolar 6mm2 H07V-K negro rollo 100m','Nexans','Cables','90.00','rollo'),
  ('NOV-CAB-105','Cable manguera 3x1.5mm2 H05VV-F blanco 100m','Nexans','Cables','65.00','rollo'),
  ('NOV-CAB-106','Cable manguera 3x2.5mm2 H05VV-F gris 100m','Nexans','Cables','95.00','rollo'),
  ('NOV-CAB-107','Cable manguera 5x2.5mm2 H05VV-F gris 100m','Nexans','Cables','138.00','rollo'),
  ('NOV-CAB-108','Cable RJ45 Cat6 FTP 305m gris bobina','Eland','Cables','195.00','bobina'),
  ('NOV-CAB-109','Cable libre halógenos 3G2.5mm2 AS 100m','Nexans','Cables','120.00','rollo'),
  ('NOV-CAB-110','Cable unipolar 10mm2 negro rollo 100m','Nexans','Cables','150.00','rollo'),
  ('NOV-CAB-111','Cable solar 6mm2 negro 100m UV resistente','Top Cable','Cables','95.00','rollo'),
  ('NOV-CAB-112','Cable apantallado 2x1mm2 audio/control 100m','Eland','Cables','78.00','rollo'),
  ('NOV-CAB-113','Cable manguera 2x1.5mm2 blanco 100m','Nexans','Cables','50.00','rollo'),
  ('NOV-CAB-114','Cable unipolar 16mm2 negro rollo 50m','Nexans','Cables','145.00','rollo'),
  ('NOV-CAB-115','Cable manguera 4x1.5mm2 H05VV-F 100m','Nexans','Cables','88.00','rollo'),
  -- Mecanismos
  ('NOV-MEC-101','Interruptor 10A 250V blanco serie Legrand Mosaic','Legrand','Mecanismos','6.20','ud'),
  ('NOV-MEC-102','Conmutador 10A 250V blanco Mosaic','Legrand','Mecanismos','6.90','ud'),
  ('NOV-MEC-103','Base enchufe schuko 16A blanco Mosaic','Legrand','Mecanismos','7.20','ud'),
  ('NOV-MEC-104','Base enchufe USB-A+USB-C 15W blanco Mosaic','Legrand','Mecanismos','22.00','ud'),
  ('NOV-MEC-105','Pulsador 10A timbre blanco Mosaic','Legrand','Mecanismos','5.50','ud'),
  ('NOV-MEC-106','Regulador LED 400W blanco Mosaic','Legrand','Mecanismos','32.00','ud'),
  ('NOV-MEC-107','Toma RJ45 Cat6 empotrar blanca Mosaic','Legrand','Mecanismos','13.50','ud'),
  ('NOV-MEC-108','Marco 1 elemento blanco Mosaic','Legrand','Mecanismos','3.20','ud'),
  ('NOV-MEC-109','Marco 2 elementos blanco Mosaic','Legrand','Mecanismos','4.80','ud'),
  ('NOV-MEC-110','Marco 3 elementos blanco Mosaic','Legrand','Mecanismos','6.20','ud'),
  ('NOV-MEC-111','Telerruptor 16A 230V Legrand','Legrand','Mecanismos','24.00','ud'),
  ('NOV-MEC-112','Minutero escalera 16A 230V','Legrand','Mecanismos','19.50','ud'),
  ('NOV-MEC-113','Interruptor diferencial 2P 25A 30mA','Legrand','Mecanismos','40.00','ud'),
  ('NOV-MEC-114','Base industrial IP44 2P+T 16A 250V','Legrand','Mecanismos','14.50','ud'),
  ('NOV-MEC-115','Sensor crepuscular 10A 230V exterior','Legrand','Mecanismos','28.00','ud'),
  -- Protecciones
  ('NOV-PRO-101','PIA 1P 10A curva C 6kA DX3','Legrand','Protecciones','13.00','ud'),
  ('NOV-PRO-102','PIA 1P 16A curva C 6kA DX3','Legrand','Protecciones','13.00','ud'),
  ('NOV-PRO-103','PIA 1P 20A curva C 6kA DX3','Legrand','Protecciones','13.50','ud'),
  ('NOV-PRO-104','PIA 2P 25A curva C 6kA DX3','Legrand','Protecciones','24.00','ud'),
  ('NOV-PRO-105','PIA 2P 40A curva C 6kA DX3','Legrand','Protecciones','30.00','ud'),
  ('NOV-PRO-106','PIA 3P 32A curva C 6kA DX3','Legrand','Protecciones','38.00','ud'),
  ('NOV-PRO-107','PIA 4P 63A curva C 10kA DX3','Legrand','Protecciones','72.00','ud'),
  ('NOV-PRO-108','Diferencial 2P 40A 30mA tipo A','Legrand','Protecciones','52.00','ud'),
  ('NOV-PRO-109','Diferencial 4P 40A 30mA tipo A','Legrand','Protecciones','92.00','ud'),
  ('NOV-PRO-110','Diferencial 4P 63A 100mA tipo AC','Legrand','Protecciones','102.00','ud'),
  ('NOV-PRO-111','Limitador sobretensión 1P+N tipo 2 clase C','Legrand','Protecciones','48.00','ud'),
  ('NOV-PRO-112','IGA 2P 40A 6kA','Legrand','Protecciones','35.00','ud'),
  ('NOV-PRO-113','Relé térmico 6-10A regulable','ABB','Protecciones','30.00','ud'),
  ('NOV-PRO-114','Contactor 4P 25A 230Vac','ABB','Protecciones','45.00','ud'),
  ('NOV-PRO-115','Relé temporizado 0.1-10s multifunción 230V','ABB','Protecciones','38.00','ud'),
  -- Luminaria
  ('NOV-LUM-101','Downlight LED 9W 3000K blanco empotrar redondo','Philips Hue','Luminaria','22.00','ud'),
  ('NOV-LUM-102','Downlight LED 18W 4000K blanco empotrar cuadrado','Ledvance','Luminaria','30.00','ud'),
  ('NOV-LUM-103','Panel LED 60x60 36W 3000K blanco UGR<19','Ledvance','Luminaria','48.00','ud'),
  ('NOV-LUM-104','Regleta LED 150cm 50W 4000K IP65 taller','Osram','Luminaria','55.00','ud'),
  ('NOV-LUM-105','Aplique exterior LED 15W 3000K IP54 antracita','Eglo','Luminaria','38.00','ud'),
  ('NOV-LUM-106','Proyector LED 100W 6000K IP66 exterior','Ledvance','Luminaria','85.00','ud'),
  ('NOV-LUM-107','Lámpara LED E27 13W 1521 lm 4000K','Ledvance','Luminaria','5.20','ud'),
  ('NOV-LUM-108','Tubo LED T8 22W 150cm 4000K','Ledvance','Luminaria','10.50','ud'),
  ('NOV-LUM-109','Luminaria emergencia 3h LED 200 lm','Legrand','Luminaria','35.00','ud'),
  ('NOV-LUM-110','Sensor movimiento IR 180° pared exterior 1200W','Legrand','Luminaria','28.00','ud'),
  ('NOV-LUM-111','Tira LED 24V 20W/m RGB+W 5m IP44','Ledvance','Luminaria','68.00','ud'),
  ('NOV-LUM-112','Foco superficie LED 20W 4000K blanco','Ledvance','Luminaria','22.00','ud'),
  -- Canalizaciones y Cuadros
  ('NOV-CAN-101','Tubo corrugado simple pared DN20 rollo 100m','Aiscan','Canalizaciones','22.00','rollo'),
  ('NOV-CAN-102','Tubo corrugado doble pared DN50 rollo 50m','Aiscan','Canalizaciones','36.00','rollo'),
  ('NOV-CAN-103','Tubo rígido PVC M20 barra 3m','Aiscan','Canalizaciones','2.50','ud'),
  ('NOV-CAN-104','Tubo rígido PVC M25 barra 3m','Aiscan','Canalizaciones','3.20','ud'),
  ('NOV-CAN-105','Canal PVC 40x25mm blanca 2m Legrand DLP','Legrand','Canalizaciones','5.80','ud'),
  ('NOV-CAN-106','Canal PVC 80x40mm blanca 2m Legrand DLP','Legrand','Canalizaciones','10.50','ud'),
  ('NOV-CAN-107','Caja empotrar mecanismo 65x65mm','Legrand','Canalizaciones','1.95','ud'),
  ('NOV-CAN-108','Caja derivación estanca IP65 80x80mm','Legrand','Canalizaciones','5.80','ud'),
  ('NOV-CAN-109','Bandeja rejilla 100mm galvanizada 3m','Legrand','Canalizaciones','22.00','ud'),
  ('NOV-CAN-110','Bandeja rejilla 200mm galvanizada 3m','Legrand','Canalizaciones','32.00','ud'),
  ('NOV-CUA-101','Cuadro distribución empotrar 24 módulos','Legrand','Cuadros','42.00','ud'),
  ('NOV-CUA-102','Cuadro distribución superficie 36 módulos','Legrand','Cuadros','58.00','ud'),
  ('NOV-CUA-103','Armario metal 400x600x200mm IP55','Legrand','Cuadros','110.00','ud'),
  ('NOV-CUA-104','Peine distribución 3P+N 63A 18 módulos','Legrand','Cuadros','26.00','ud')
) AS v(ref, descr, marca, familia, precio, unidad)
WHERE c.supplier_key = 'novelec'
AND NOT EXISTS (
  SELECT 1 FROM public.trade_supplier_products p2
  WHERE p2.catalog_id = c.id AND p2.ref_proveedor = v.ref
);

UPDATE public.trade_supplier_products p
SET search_vector = to_tsvector('spanish',
  coalesce(p.descripcion,'') || ' ' || coalesce(p.familia,'') || ' ' || coalesce(p.marca,''))
FROM public.trade_supplier_catalogs c
WHERE p.catalog_id = c.id AND c.supplier_key = 'novelec' AND p.search_vector IS NULL;
;
