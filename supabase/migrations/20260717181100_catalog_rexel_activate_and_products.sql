
UPDATE public.trade_supplier_catalogs
SET is_active = true, acuerdo_estado = 'activo'
WHERE supplier_key = 'rexel';

INSERT INTO public.trade_supplier_products (catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad, activo)
SELECT c.id, v.ref, v.descr, v.marca, v.familia, v.precio::numeric, v.unidad, true
FROM public.trade_supplier_catalogs c
CROSS JOIN (VALUES
  -- Cables ABB / Prysmian premium
  ('REX-CAB-101','Cable unipolar 1.5mm2 H07V-K amarillo-verde 100m','Top Cable','Cables','26.00','rollo'),
  ('REX-CAB-102','Cable unipolar 2.5mm2 H07V-K azul 100m','Top Cable','Cables','38.00','rollo'),
  ('REX-CAB-103','Cable unipolar 4mm2 H07V-K negro 100m','Top Cable','Cables','58.00','rollo'),
  ('REX-CAB-104','Cable unipolar 6mm2 H07V-K marrón 100m','Top Cable','Cables','88.00','rollo'),
  ('REX-CAB-105','Cable manguera 3x1.5mm2 RVFV 100m gris','Top Cable','Cables','72.00','rollo'),
  ('REX-CAB-106','Cable manguera 3x2.5mm2 RVFV 100m gris','Top Cable','Cables','105.00','rollo'),
  ('REX-CAB-107','Cable libre halógenos 3G1.5mm2 AFUMEX 100m','Prysmian','Cables','98.00','rollo'),
  ('REX-CAB-108','Cable libre halógenos 3G2.5mm2 AFUMEX 100m','Prysmian','Cables','138.00','rollo'),
  ('REX-CAB-109','Cable RJ45 Cat6A S/FTP 305m LSZH','Draka','Cables','245.00','bobina'),
  ('REX-CAB-110','Cable Bus KNX 2x2x0.8mm YCYM 100m','Jung','Cables','145.00','rollo'),
  ('REX-CAB-111','Cable fibra óptica multimodo OM3 4FO 200m','Draka','Cables','185.00','bobina'),
  ('REX-CAB-112','Cable manguera 5x4mm2 H05VV-F 100m','Top Cable','Cables','195.00','rollo'),
  ('REX-CAB-113','Cable unipolar 10mm2 negro 100m','Top Cable','Cables','158.00','rollo'),
  ('REX-CAB-114','Cable solar 4mm2 rojo 100m','Top Cable','Cables','82.00','rollo'),
  -- Mecanismos ABB / Jung
  ('REX-MEC-101','Interruptor 10A 250V blanco Zenit ABB','ABB','Mecanismos','7.20','ud'),
  ('REX-MEC-102','Conmutador 10A 250V blanco Zenit ABB','ABB','Mecanismos','7.80','ud'),
  ('REX-MEC-103','Base enchufe schuko 16A blanco Zenit ABB','ABB','Mecanismos','8.20','ud'),
  ('REX-MEC-104','Base enchufe con USB-A 5V 2.1A blanco ABB','ABB','Mecanismos','22.00','ud'),
  ('REX-MEC-105','Regulador LED 400W blanco Zenit ABB','ABB','Mecanismos','38.00','ud'),
  ('REX-MEC-106','Toma RJ45 Cat6 UTP blanca Zenit ABB','ABB','Mecanismos','14.50','ud'),
  ('REX-MEC-107','Pulsador 10A blanco Zenit ABB','ABB','Mecanismos','6.50','ud'),
  ('REX-MEC-108','Marco 1 elemento blanco Zenit ABB','ABB','Mecanismos','3.50','ud'),
  ('REX-MEC-109','Marco 2 elementos blanco Zenit ABB','ABB','Mecanismos','5.20','ud'),
  ('REX-MEC-110','Detector movimiento KNX empotrar Jung','Jung','Mecanismos','95.00','ud'),
  ('REX-MEC-111','Termostato KNX empotrar Jung 2178','Jung','Mecanismos','185.00','ud'),
  ('REX-MEC-112','Programador horario digital carril DIN 16A','Orbis','Mecanismos','38.00','ud'),
  -- Protecciones ABB
  ('REX-PRO-101','PIA 1P 10A curva B 10kA ABB S200','ABB','Protecciones','15.00','ud'),
  ('REX-PRO-102','PIA 1P 16A curva B 10kA ABB S200','ABB','Protecciones','15.00','ud'),
  ('REX-PRO-103','PIA 2P 25A curva C 10kA ABB S200M','ABB','Protecciones','28.00','ud'),
  ('REX-PRO-104','PIA 3P 32A curva C 10kA ABB S200M','ABB','Protecciones','42.00','ud'),
  ('REX-PRO-105','PIA 4P 63A curva C 15kA ABB S200M','ABB','Protecciones','78.00','ud'),
  ('REX-PRO-106','Diferencial 2P 40A 30mA tipo A ABB F200','ABB','Protecciones','58.00','ud'),
  ('REX-PRO-107','Diferencial 4P 63A 30mA tipo A ABB F200','ABB','Protecciones','108.00','ud'),
  ('REX-PRO-108','Interruptor diferencial 2P 40A 300mA selectivo','ABB','Protecciones','95.00','ud'),
  ('REX-PRO-109','Limitador sobretensión 1P+N tipo 1+2 OVR','ABB','Protecciones','65.00','ud'),
  ('REX-PRO-110','Contactor 3P 25A 230V AC3 AF26','ABB','Protecciones','52.00','ud'),
  ('REX-PRO-111','Contactor 4P 40A 230V AF40','ABB','Protecciones','78.00','ud'),
  ('REX-PRO-112','Relé térmico 12-18A TF42','ABB','Protecciones','35.00','ud'),
  -- Luminaria Osram / Thorn
  ('REX-LUM-101','Downlight LED empotrar 9W 3000K plateado','Thorn','Luminaria','25.00','ud'),
  ('REX-LUM-102','Downlight LED empotrar 19W 4000K blanco','Thorn','Luminaria','38.00','ud'),
  ('REX-LUM-103','Panel LED 60x60 36W 4000K DALI regulable','Thorn','Luminaria','68.00','ud'),
  ('REX-LUM-104','Regleta LED 120cm 40W 4000K IP65','Thorn','Luminaria','48.00','ud'),
  ('REX-LUM-105','Proyector LED 50W 4000K IP66 exterior','Thorn','Luminaria','75.00','ud'),
  ('REX-LUM-106','Luminaria emergencia 3h LED 200lm DAISALUX','Daisalux','Luminaria','42.00','ud'),
  ('REX-LUM-107','Luminaria emergencia 1h LED 100lm DAISALUX','Daisalux','Luminaria','32.00','ud'),
  ('REX-LUM-108','Lámpara LED E27 13W 827 cálida','Osram','Luminaria','5.80','ud'),
  ('REX-LUM-109','Tubo LED T8 18W 840 120cm','Osram','Luminaria','9.50','ud'),
  ('REX-LUM-110','Sensor presencia DALI techo 360° Schneider','Schneider','Luminaria','65.00','ud'),
  -- Canalizaciones y Cuadros
  ('REX-CAN-101','Tubo rígido PVC M20 barra 3m EN50086','Aiscan','Canalizaciones','2.60','ud'),
  ('REX-CAN-102','Tubo corrugado DN32 doble pared rollo 50m','Aiscan','Canalizaciones','32.00','rollo'),
  ('REX-CAN-103','Canal PVC 60x40mm UNEX barra 2m blanca','Unex','Canalizaciones','8.20','ud'),
  ('REX-CAN-104','Canal PVC 100x60mm UNEX barra 2m blanca','Unex','Canalizaciones','13.50','ud'),
  ('REX-CAN-105','Bandeja perforada 100mm acero galvanizado 3m','Pemsa','Canalizaciones','20.00','ud'),
  ('REX-CAN-106','Bandeja rejilla 300mm galvanizada 3m','Pemsa','Canalizaciones','38.00','ud'),
  ('REX-CAN-107','Caja derivación IP66 150x110mm Spelsberg','Spelsberg','Canalizaciones','12.00','ud'),
  ('REX-CUA-101','Cuadro distribución empotrar 24 módulos ABB','ABB','Cuadros','52.00','ud'),
  ('REX-CUA-102','Cuadro distribución superficie 36 módulos ABB','ABB','Cuadros','72.00','ud'),
  ('REX-CUA-103','Armario metálico IP55 400x600x200mm','Rittal','Cuadros','145.00','ud'),
  ('REX-CUA-104','Peine distribución 3P+N 63A 24 módulos ABB','ABB','Cuadros','30.00','ud'),
  ('REX-CUA-105','Embarrado cobre 4P 100A para cuadro','ABB','Cuadros','28.00','ud')
) AS v(ref, descr, marca, familia, precio, unidad)
WHERE c.supplier_key = 'rexel'
AND NOT EXISTS (
  SELECT 1 FROM public.trade_supplier_products p2
  WHERE p2.catalog_id = c.id AND p2.ref_proveedor = v.ref
);

UPDATE public.trade_supplier_products p
SET search_vector = to_tsvector('spanish',
  coalesce(p.descripcion,'') || ' ' || coalesce(p.familia,'') || ' ' || coalesce(p.marca,''))
FROM public.trade_supplier_catalogs c
WHERE p.catalog_id = c.id AND c.supplier_key = 'rexel' AND p.search_vector IS NULL;
;
