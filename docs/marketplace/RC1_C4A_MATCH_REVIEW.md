# RC1-C.4A — Matriz de Matching para Revisión Humana (A10)

**Estado:** PENDIENTE DE APROBACIÓN  
**Versión:** 1.0 — 2026-08-08  
**Regla:** NO promover a `matched` sin aprobación explícita de esta matriz.

---

## Instrucción

Revisar cada fila. Para cada offering:
- ✅ `APROBAR` → la offering se promueve a `match_state='matched'` y queda disponible en Marketplace
- ❌ `RECHAZAR` → la offering se elimina o se ajusta antes de volver a revisar
- ⚠️ `REVISAR` → requiere aclaración antes de decidir (ver notas)

---

## GRUPO 1 — Lavabo sobre encimera

**UP:** Lavabo sobre encimera (`bf93aa66`) · familia: Sanitarios · unidad: ud  
**Descripción UP:** Lavabo de cerámica o porcelana sanitaria para colocar sobre encimera o mueble de baño.  
**Confianza de match:** 0.85

| Campo | OYM-SAN-1001 | STN-SAN-1001 |
|-------|-------------|-------------|
| Proveedor | Obras y Materiales S.L. | Suministros Técnicos Norte S.L. |
| Descripción comercial | Lavabo sobre encimera cerámica blanco 60cm | Lavabo sobre encimera porcelana sanitaria 60cm — clase A |
| Unidad | ud | ud |
| Precio profesional neto | 82,00 € | 91,00 € |
| PVP neto | 119,00 € | 139,00 € |
| Stock | Sí (12 ud) | Sí (5 ud) |
| Plazo | 3 días | 2 días |
| Dimensión declarada | 60 cm | 60 cm |
| Contradicción con UP | Ninguna — dimensión es informativa | Ninguna |
| Recomendación | ✅ APROBAR | ✅ APROBAR |

**Nota:** Ambas offerings declaran 60cm. El UP es genérico (no especifica dimensión). No hay contradicción técnica.

---

## GRUPO 2 — Silicona sanitaria sellado *(UP nuevo)*

**UP:** Silicona sanitaria sellado (`bf23c4f8`) · familia: Accesorios · subfamilia: Sellantes · unidad: cartucho  
**Descripción UP:** Silicona neutra o acética para sellado de juntas en baños y zonas húmedas. Resistente al agua, moho y detergentes.  
**Confianza de match:** 0.88

| Campo | OYM-ACC-0101 | STN-ACC-0101 |
|-------|-------------|-------------|
| Proveedor | Obras y Materiales S.L. | Suministros Técnicos Norte S.L. |
| Descripción comercial | Silicona sanitaria blanca cartucho 310ml — moho-resistente | Silicona neutra sanitaria 310ml — resistente moho clase A |
| Unidad | cartucho (310ml) | cartucho (310ml) |
| Precio profesional neto | 4,20 € | 4,80 € |
| PVP neto | 6,50 € | 7,20 € |
| Stock | Sí (80 ud) | Sí (40 ud) |
| Plazo | 3 días | 2 días |
| Contradicción | Ninguna | Ninguna |
| Recomendación | ✅ APROBAR | ✅ APROBAR |

**Nota:** UP nuevo creado en esta fase. Ambas offerings son silicona sanitaria estándar de 310ml — producto muy estandarizado, riesgo de match incorrecto mínimo.

---

## GRUPO 3 — Kit conexiones fontanería baño *(UP nuevo)*

**UP:** Kit conexiones fontanería baño (`c319d0e3`) · familia: Saneamiento · subfamilia: Conexiones y Accesorios · unidad: kit  
**Descripción UP:** Kit de conexiones para instalación de sanitarios: llaves de escuadra 1/2", flexibles de conexión sanitaria, collarines y pequeño material de fontanería.  
**Confianza de match:** 0.87

| Campo | STN-KIT-0201 | OYM-KIT-0201 |
|-------|-------------|-------------|
| Proveedor | Suministros Técnicos Norte S.L. | Obras y Materiales S.L. |
| Descripción comercial | Kit conexiones baño — 2x llave escuadra 1/2" + 2x flexible 40cm | Kit fontanería baño — llaves escuadra + flexibles + collarines |
| Unidad | kit | kit |
| Precio profesional neto | 13,80 € | 12,50 € |
| PVP neto | 21,00 € | 18,50 € |
| Stock | Sí (35 ud) | Sí (22 ud) |
| Plazo | 2 días | 3 días |
| Contenido declarado | 2 llaves + 2 flexibles 40cm | llaves + flexibles + collarines |
| Contradicción | El contenido varía entre kits — es normal en este tipo de producto | Idem |
| Recomendación | ✅ APROBAR | ✅ APROBAR |

**Nota:** Los kits de fontanería varían en composición entre proveedores. Lo relevante es que ambos cubren el mismo uso funcional (adaptación fontanería baño).

---

## GRUPO 4 — Mecanismo interruptor/pulsador IP44 *(UP nuevo)*

**UP:** Mecanismo interruptor pulsador IP44 (`0d72f97f`) · familia: Mecanismos · subfamilia: Interruptores · unidad: ud  
**Descripción UP:** Interruptor unipolar o pulsador para zona húmeda (baño), protección IP44. Compatible con series estándar.  
**Confianza de match:** 0.87 / 0.86

| Campo | ESC-MEC-1102 | STN-MEC-0401 |
|-------|-------------|-------------|
| Proveedor | ElectroSuministros Cantábrico S.L. | Suministros Técnicos Norte S.L. |
| Descripción comercial | Interruptor unipolar IP44 baño blanco — con tecla y marco | Pulsador IP44 baño zona húmeda blanco — pack 2 ud |
| Unidad | ud | ud |
| Precio profesional neto | 6,80 € | 7,40 € |
| PVP neto | 11,50 € | 12,80 € |
| Stock | Sí (20 ud) | Sí (15 ud) |
| Plazo | 2 días | 2 días |
| ⚠️ Divergencia | ESC: interruptor unipolar. STN: pulsador. Son mecanismos distintos. | Idem |
| Recomendación | ✅ APROBAR (interruptor) | ⚠️ REVISAR: confirmar si el UP debe cubrir AMBOS tipos o crear UPs separados |

**Nota importante:** Un interruptor unipolar (on/off permanente) y un pulsador (momentáneo, típico para ventilador temporizado) son productos distintos aunque comparten el formato IP44. El UP los agrupa como "interruptor/pulsador" — esto es una decisión de diseño que se debe confirmar. Si se quieren separar, crear UP "Mecanismo pulsador IP44" adicional.

---

## GRUPO 5 — Mueble bajo lavabo 80cm *(UP nuevo)*

**UP:** Mueble bajo lavabo 80cm (`56685ebb`) · familia: Carpintería · subfamilia: Muebles de Baño · unidad: ud  
**Descripción UP:** Mueble de baño suspendido de 80cm de ancho para lavabo sobre encimera o integrado. Sin lavabo incluido.  
**Confianza de match:** 0.84

| Campo | OYM-MUE-3002 |
|-------|-------------|
| Proveedor | Obras y Materiales S.L. |
| Descripción comercial | Mueble baño suspendido 80cm blanco mate — 2 cajones soft-close |
| Unidad | ud |
| Precio profesional neto | 185,00 € |
| PVP neto | 279,00 € |
| Stock | Sí (4 ud) |
| Plazo | 5 días |
| ⚠️ Aclaración | El presupuesto PRE-085 describe "Conjunto mueble 80cm + lavabo + espejo LED retroiluminado + instalación" como un único ítem. Esta offering cubre SOLO el mueble (sin lavabo ni espejo). |
| Recomendación | ✅ APROBAR — es el componente principal del conjunto. El lavabo y espejo son UPs separados con sus propias offerings. |

---

## GRUPO 6 — Caja empotrar y pequeño material eléctrico *(UP nuevo)*

**UP:** Caja empotrar y pequeño material eléctrico (`4898dc86`) · familia: Electricidad · subfamilia: Accesorios Eléctricos · unidad: kit  
**Descripción UP:** Caja de empotrar para mecanismos eléctricos, cinta aislante, bridas de sujeción y elementos de pequeño material para instalación eléctrica.  
**Confianza de match:** 0.82

| Campo | ESC-KIT-0001 |
|-------|-------------|
| Proveedor | ElectroSuministros Cantábrico S.L. |
| Descripción comercial | Kit pequeño material eléctrico instalación — cajas + cinta + bridas |
| Unidad | kit |
| Precio profesional neto | 9,20 € |
| PVP neto | 14,00 € |
| Stock | Sí (25 ud) |
| Plazo | 2 días |
| Contradicción | Ninguna |
| Recomendación | ✅ APROBAR |

---

## GRUPO 7 — Azulejo rectificado pared (offering adicional)

**UP:** Azulejo rectificado pared (`447c832f`) · familia: Revestimientos · unidad: m²  
**Offerings existentes:** 1 matched (Revestimientos y Obra Norte S.L.)  
**Confianza de match:** 0.84

| Campo | OYM-REV-1001 |
|-------|-------------|
| Proveedor | Obras y Materiales S.L. |
| Descripción comercial | Azulejo rectificado pared formato 30x60cm blanco mate — caja 1.26m² |
| Unidad | m² |
| Precio profesional neto | 18,50 €/m² |
| PVP neto | 27,00 €/m² |
| Stock | Sí (45 m²) |
| Plazo | 4 días |
| Formato declarado | 30×60cm | 
| ⚠️ Aclaración | El UP no especifica formato. Esta offering declara 30×60cm blanco mate. Confirmar que el UP es genérico (agrupa todos los formatos) y que esto no contradice otros azulejos del catálogo. |
| Recomendación | ✅ APROBAR — el UP es genérico (`es_generico=true`) y admite variantes de formato. |

---

## GRUPO 8 — Baldosa porcelánica 60×60 (offering adicional)

**UP:** Baldosa porcelánica 60×60 (`9d230f15`) · familia: Revestimientos · unidad: m²  
**Offerings existentes:** 1 matched (Revestimientos y Obra Norte S.L.)  
**Confianza de match:** 0.84

| Campo | OYM-REV-2001 |
|-------|-------------|
| Proveedor | Obras y Materiales S.L. |
| Descripción comercial | Baldosa porcelánica 60x60cm antideslizante R11 — gris claro rectificada |
| Unidad | m² |
| Precio profesional neto | 22,80 €/m² |
| PVP neto | 33,50 €/m² |
| Stock | Sí (30 m²) |
| Plazo | 4 días |
| Certificación R11 | Declarada en descripción comercial | 
| Contradicción con UP | UP se llama "60×60" — esta offering declara 60x60 ✓ |
| Recomendación | ✅ APROBAR |

---

## Resumen de recomendaciones

| # | Ref | Proveedor | UP | Recomendación |
|---|-----|-----------|-----|--------------|
| 1 | OYM-SAN-1001 | Obras y Materiales | Lavabo sobre encimera | ✅ APROBAR |
| 2 | STN-SAN-1001 | STN | Lavabo sobre encimera | ✅ APROBAR |
| 3 | OYM-ACC-0101 | Obras y Materiales | Silicona sanitaria | ✅ APROBAR |
| 4 | STN-ACC-0101 | STN | Silicona sanitaria | ✅ APROBAR |
| 5 | STN-KIT-0201 | STN | Kit conexiones fontanería | ✅ APROBAR |
| 6 | OYM-KIT-0201 | Obras y Materiales | Kit conexiones fontanería | ✅ APROBAR |
| 7 | ESC-MEC-1102 | ElectroSuministros | Interruptor IP44 | ✅ APROBAR |
| 8 | STN-MEC-0401 | STN | Pulsador IP44 | ⚠️ REVISAR (¿UP unificado o separar pulsador?) |
| 9 | OYM-MUE-3002 | Obras y Materiales | Mueble bajo lavabo 80cm | ✅ APROBAR |
| 10 | ESC-KIT-0001 | ElectroSuministros | Caja empotrar / small eléctrico | ✅ APROBAR |
| 11 | OYM-REV-1001 | Obras y Materiales | Azulejo rectificado pared | ✅ APROBAR |
| 12 | OYM-REV-2001 | Obras y Materiales | Baldosa porcelánica 60×60 | ✅ APROBAR |

---

## SQL de promoción (ejecutar SOLO tras aprobación)

```sql
-- Promover a matched — EJECUTAR SOLO TRAS APROBACIÓN EXPLÍCITA
UPDATE trade_marketplace_supplier_offerings
SET
  match_state = 'matched',
  matched_at  = now()
WHERE supplier_ref IN (
  'OYM-SAN-1001', 'STN-SAN-1001',
  'OYM-ACC-0101', 'STN-ACC-0101',
  'STN-KIT-0201', 'OYM-KIT-0201',
  'ESC-MEC-1102',
  -- 'STN-MEC-0401',  -- EN REVISIÓN: pulsador vs interruptor
  'OYM-MUE-3002',
  'ESC-KIT-0001',
  'OYM-REV-1001', 'OYM-REV-2001'
)
AND match_state = 'pending_review';
```

---

## SQL de rollback completo (si se necesita deshacer FASE A)

```sql
-- ROLLBACK FASE A — eliminar todo lo creado en esta fase
BEGIN;

-- Eliminar offerings nuevas (pending_review creadas en FASE A)
DELETE FROM trade_marketplace_supplier_offerings
WHERE supplier_ref IN (
  'OYM-SAN-1001','STN-SAN-1001',
  'OYM-ACC-0101','STN-ACC-0101',
  'STN-KIT-0201','OYM-KIT-0201',
  'ESC-MEC-1102','STN-MEC-0401',
  'OYM-MUE-3002',
  'ESC-KIT-0001',
  'OYM-REV-1001','OYM-REV-2001'
);

-- Eliminar UPs nuevos (P1, P2, P3)
DELETE FROM trade_marketplace_universal_products
WHERE id IN (
  'bf23c4f8-5ca5-4eba-930f-5bfc68f28fdf',  -- Silicona sanitaria
  'c319d0e3-2a52-4935-8909-fa177c5c0657',  -- Kit conexiones fontanería
  '0d72f97f-a712-40f9-8ead-f0119ff38f2b',  -- Mecanismo interruptor IP44
  '56685ebb-c64e-42bf-bb72-dbefa1bba230',  -- Mueble bajo lavabo 80cm
  '4898dc86-e3ec-4bd4-aaa1-1569b1d65a2d'   -- Caja empotrar
);

-- Limpiar aliases de UPs existentes
UPDATE trade_marketplace_universal_products
SET search_aliases = '{}'
WHERE id IN (
  '8a235fa5-1583-48e6-824f-74433b8836d6',  -- Sifón y desagüe ducha
  '0f1411fd-d880-4d1b-9eb7-11c13a427eb6',  -- Membrana impermeabilizante
  '0bb256f1-4bc0-47e4-b97d-ce22eecc70da',  -- Mampara de ducha
  '7ba1e338-6fa5-47a2-bcfc-16c138c66974',  -- Grifo monomando lavabo
  '3c77b38c-ebeb-429b-8bea-48df7e6c78a3',  -- Grifo monomando ducha
  '43cf0878-930c-48d8-94f4-7c59d5f904ac',  -- Mecanismo enchufe schuko IP44
  '8373f246-54be-4fba-b97f-ce76d2b4750d',  -- Luminaria baño LED IP44
  '7e502022-35d2-4f6d-8409-50f60becec7c',  -- Pintura plástica anti-humedad
  '447c832f-15d6-4b34-9a5a-51bd754f26c2',  -- Azulejo rectificado pared
  '9d230f15-6c83-4aed-bcb7-70ac2a1dbfc0',  -- Baldosa porcelánica 60x60
  '13c782c5-e98b-4af7-9688-c486b3766918'   -- Cemento cola C2
);

-- Revertir rename OBRAMAT (si se desea)
UPDATE trade_marketplace_actors
SET nombre = 'OBRAMAT Demo', legal_name = 'OBRAMAT Demo (Pilot Zero)'
WHERE id = '85e73234-c74e-44e7-865a-1aca8312f9a5';

UPDATE trade_supplier_catalogs
SET supplier_name = 'OBRAMAT'
WHERE id = '280c05e5-7590-4ca1-82d0-fc8977a919d8';

COMMIT;
```
