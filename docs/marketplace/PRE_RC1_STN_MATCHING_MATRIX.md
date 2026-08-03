# PRE-RC1 — Matriz de Matching: STN vs Universal Products

**Versión:** 1.0  
**Fecha:** 2026-08-03  
**Estado:** ANÁLISIS — pendiente de acción del admin en el panel  
**Tipo:** Guía de emparejamiento — NO implica cambios de datos directos

---

## 1. Objetivo

Este documento guía al admin para emparejar las 12 offerings de Suministros Técnicos Norte S.L. con UPs (`trade_marketplace_universal_products`) en el panel de administración.

El matching asigna `universal_product_id` en `trade_marketplace_supplier_offerings` y cambia el `match_state` de `pending_review` a `matched`. Este trabajo lo hace el admin desde el panel — este documento es solo la guía de decisión.

---

## 2. Criterios de matching

### 2.1 Matching con UP existente (preferido)

Si ya existe una UP que represente el tipo de producto genérico:
- Asignar `universal_product_id` → UP existente
- El offering STN queda emparejado con esa UP
- Si OBRAMAT ya tiene un offering en esa misma UP → se habilita la comparación de precios

### 2.2 Creación de UP nueva (si no existe)

Si no existe una UP del tipo correcto:
- Crear nueva UP en `trade_marketplace_universal_products`
- Definir: `nombre`, `categoria`, `familia`, `unidad`, `descripcion`
- Emparejar el offering STN a la nueva UP
- Posteriormente emparejar offerings OBRAMAT del backlog a la misma UP (si hay equivalente)

### 2.3 No emparejar (pending indefinido)

Si la referencia es muy específica y no tiene sentido como UP genérica, dejar en `pending_review`. No se debe forzar un matching incorrecto.

---

## 3. Matriz de matching por offering

### STN-FON-001: Grifo monomando lavabo caño alto cromado (€43.50)

```
Categoría sugerida:  Fontanería > Griferías > Grifo lavabo
UP genérica:         "Grifo monomando lavabo caño alto cromado"
Atributos clave:     Tipo: monomando, Instalación: sobre encimera, Acabado: cromado
¿UP OBRAMAT equiv?:  Buscar en backlog offerings OBRAMAT con "grifo lavabo caño alto"
Prioridad demo:      ALTA — artículo de baño muy común, ideal para mostrar comparación
```

### STN-FON-002: Grifo monomando lavabo caño bajo cromado (€36.50)

```
Categoría sugerida:  Fontanería > Griferías > Grifo lavabo
UP genérica:         "Grifo monomando lavabo caño bajo cromado"
Atributos clave:     Tipo: monomando, Instalación: sobre encimera, Caño: bajo, Acabado: cromado
¿UP OBRAMAT equiv?:  Buscar "grifo lavabo caño bajo" en backlog
Prioridad demo:      ALTA — versión económica, buena para mostrar rango de precios
```

### STN-FON-004: Grifo monomando ducha empotrado cromado (€85.00)

```
Categoría sugerida:  Fontanería > Griferías > Grifo ducha
UP genérica:         "Grifo monomando ducha empotrado cromado"
Atributos clave:     Tipo: monomando, Instalación: empotrado, Acabado: cromado
¿UP OBRAMAT equiv?:  Probablemente NO en el backlog (OBRAMAT tiende a griferías de encimera)
Acción sugerida:     Crear UP nueva si no existe
Prioridad demo:      MEDIA — diferenciador entre proveedores
```

### STN-FON-006: Válvula de esfera palanca 1/2" PN25 latón (€6.50)

```
Categoría sugerida:  Fontanería > Valvulería > Válvula de corte
UP genérica:         "Válvula de esfera palanca 1/2 pulgada latón PN25"
Atributos clave:     Tipo: esfera, Accionamiento: palanca, Diámetro: 1/2", Presión: PN25, Material: latón
¿UP OBRAMAT equiv?:  Muy probable (válvulas de corte son artículo básico)
Prioridad demo:      ALTA — precio bajo ideal para mostrar en presupuestos de fontanería
```

### STN-FON-011: Plato de ducha resina antideslizante 80x80 blanco (€183.00)

```
Categoría sugerida:  Fontanería > Sanitarios > Plato de ducha
UP genérica:         "Plato de ducha resina antideslizante 80x80 blanco"
Atributos clave:     Material: resina, Acabado: antideslizante, Medidas: 80x80cm, Color: blanco
¿UP OBRAMAT equiv?:  Probable — 80x80 es el tamaño estándar más común
Prioridad demo:      MUY ALTA — diferenciación de precio entre proveedores muy visible
```

### STN-FON-012: Plato de ducha resina antideslizante 90x90 blanco (€209.00)

```
Categoría sugerida:  Fontanería > Sanitarios > Plato de ducha
UP genérica:         "Plato de ducha resina antideslizante 90x90 blanco"
Atributos clave:     Material: resina, Acabado: antideslizante, Medidas: 90x90cm, Color: blanco
¿UP OBRAMAT equiv?:  Probable
Prioridad demo:      ALTA
```

### STN-FON-013: Plato de ducha resina extraplano 120x80 blanco (€262.00, SIN STOCK)

```
Categoría sugerida:  Fontanería > Sanitarios > Plato de ducha
UP genérica:         "Plato de ducha resina extraplano 120x80 blanco"
Atributos clave:     Material: resina, Perfil: extraplano, Medidas: 120x80cm, Color: blanco
¿UP OBRAMAT equiv?:  Posible
Nota demo:           Sin stock — útil para demostrar estado de disponibilidad en el UI
Prioridad demo:      MEDIA
```

### STN-FON-014: Mampara de ducha angular 80x80 cristal 6mm (€238.00)

```
Categoría sugerida:  Fontanería > Sanitarios > Mampara de ducha
UP genérica:         "Mampara de ducha angular 80x80 cristal 6mm"
Atributos clave:     Tipo: angular, Medidas: 80x80cm, Cristal: 6mm templado
¿UP OBRAMAT equiv?:  Posible (mamparas angulares son comunes)
Prioridad demo:      ALTA — artículo de alto precio, buena diferenciación
```

### STN-FON-015: Mampara de ducha frontal 120cm abatible cristal 6mm (€288.00, SIN STOCK)

```
Categoría sugerida:  Fontanería > Sanitarios > Mampara de ducha
UP genérica:         "Mampara de ducha frontal 120cm abatible cristal 6mm"
Atributos clave:     Tipo: frontal abatible, Ancho: 120cm, Cristal: 6mm templado
¿UP OBRAMAT equiv?:  Posible
Nota demo:           Sin stock — mismo uso que STN-FON-013
Prioridad demo:      MEDIA
```

### STN-FON-016: Inodoro compacto suspendido porcelana blanca (€189.00)

```
Categoría sugerida:  Fontanería > Sanitarios > Inodoro
UP genérica:         "Inodoro compacto suspendido porcelana blanca"
Atributos clave:     Tipo: compacto, Instalación: suspendido, Material: porcelana, Color: blanco
¿UP OBRAMAT equiv?:  Probable
Prioridad demo:      ALTA — pieza central de un baño, precio visible
```

### STN-FON-018: Lavabo sobre encimera oval porcelana blanca (€85.00)

```
Categoría sugerida:  Fontanería > Sanitarios > Lavabo
UP genérica:         "Lavabo sobre encimera oval porcelana blanca"
Atributos clave:     Instalación: sobre encimera, Forma: oval, Material: porcelana, Color: blanco
¿UP OBRAMAT equiv?:  Posible
Prioridad demo:      ALTA — frecuente en reformas de baño
```

### STN-FON-030: Kit desagüe plato ducha click-clack 90mm inox (€21.00)

```
Categoría sugerida:  Fontanería > Accesorios > Desagüe
UP genérica:         "Kit desagüe plato ducha click-clack 90mm inox"
Atributos clave:     Tipo: click-clack, Diámetro: 90mm, Material: inox
¿UP OBRAMAT equiv?:  Probable (accesorio estándar)
Prioridad demo:      MEDIA — artículo complementario, buen ejemplo de accesorios
```

---

## 4. Prioridad de matching para el demo

Para el primer demo funcional, se recomienda priorizar por impacto visual en el checkout:

| Prioridad | Ref. STN | Razón |
|---|---|---|
| 1 | STN-FON-011 | Plato 80x80 — el más vendido, precio visible |
| 2 | STN-FON-001 | Grifo lavabo caño alto — muy frecuente en presupuestos de baño |
| 3 | STN-FON-016 | Inodoro suspendido — pieza de alto precio |
| 4 | STN-FON-014 | Mampara angular — precio diferenciado respecto a OBRAMAT |
| 5 | STN-FON-006 | Válvula 1/2" — precio bajo, buena para presupuestos completos |
| 6–12 | Resto | Completar según disponibilidad de UPs en el panel |

---

## 5. Propuesta de punto de recogida

Se propone crear un punto de recogida para STN en Torrelavega (principal zona industrial de Cantabria):

```
Nombre:           Almacén Central STN — Torrelavega
Dirección:        Polígono Industrial La Mora, Calle Industria 14
Municipio:        Torrelavega
Provincia:        Cantabria
CP:               39300
Horario:          L-V 8:00-18:00, S 9:00-13:00
Plazo recogida:   Mismo día si el pedido es antes de las 15:00
```

**Esta propuesta NO se ha insertado en la BD.** Requiere aprobación antes de ejecutar el INSERT en `trade_supplier_pickup_points`.

---

## 6. Acciones pendientes del admin

Para completar el emparejamiento, el admin debe:

1. Abrir el panel de administración → Central de Compras → Offerings pendientes de review
2. Filtrar por proveedor "Suministros Técnicos Norte S.L."
3. Para cada uno de los 12 offerings:
   - Buscar la UP correspondiente por descripción
   - Si existe: asignar (`match_state` → `matched`)
   - Si no existe: crear la UP primero, luego asignar
4. Una vez emparejados, asignar imágenes a las UPs nuevas
5. Verificar que las UPs emparejadas con STN Y con OBRAMAT muestran comparativa en el front

---

## 7. Criterio de éxito para el matching PRE-RC1

**Mínimo viable para el demo:**
- Al menos 5 offerings STN emparejadas a UPs
- Al menos 3 de esas UPs también tienen offering de OBRAMAT (comparación real)
- Al menos 2 de esas UPs tienen imagen asignada

**Óptimo para el demo:**
- Los 10 con stock emparejados
- Al menos 6 con equivalente en OBRAMAT
- Todas las UPs nuevas con imagen

---

## 8. Nota sobre el proceso de matching

El matching lo hace el admin desde la interfaz del panel — no se hace mediante SQL directo porque:
1. El panel registra `match_method = 'admin_manual'` y `matched_by = admin_user_id`
2. El panel puede enviar notificaciones al proveedor sobre el estado de matching
3. Es más seguro para no romper la integridad relacional (checks de la tabla)

Si por necesidad urgente se necesita hacer matching vía SQL, la query es:

```sql
UPDATE public.trade_marketplace_supplier_offerings
SET 
  universal_product_id = '<up_uuid>',
  match_state          = 'matched',
  match_method         = 'admin_manual',
  matched_at           = now()
WHERE supplier_ref = 'STN-FON-XXX'
  AND supplier_catalog_id = '1aec572f-d22c-4556-9fbf-315ec7b3ba02';
```

Ejecutar uno por uno, verificando el `universal_product_id` correcto antes de cada UPDATE.
