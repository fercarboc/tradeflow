# PILOT_ZERO_RUNBOOK — Registro de ejecución de ciclos

**Versión:** 1.0 — Julio 2026  
**Propósito:** Registro oficial de cada ciclo del Pilot Zero. Cada ciclo se documenta aquí con resultado, tiempos observados, incidencias y acciones tomadas.  
**Responsable técnico:** Fernando (TrabFlow)

---

## Estado global del piloto

| Fase | Ciclos | Estado |
|---|---|---|
| Fase 0 — Preparación | — | ✅ Completada |
| Fase 1 — Validación | PZ-001 a PZ-003 | ⏳ Pendiente ejecución |
| Fase 2 — Estabilidad | PZ-004 a PZ-025 | ⏸ Bloqueada hasta aprobación Fase 1 |

---

## Plantilla de ciclo

Copiar para cada ciclo nuevo.

```markdown
### PZ-XXX — [Escenario] — [Fecha]

**Escenario:** A / B / C / D / E  
**Ejecutado por:** [nombre]  
**Duración total:** [minutos]

#### Flujo instalador (legal@inmostay.com)

| Paso | Resultado | Tiempo (s) | Notas |
|---|---|---|---|
| 1. Crear presupuesto por voz | ✅ / ❌ | | |
| 2. Guardar presupuesto | ✅ / ❌ | | |
| 3. Aceptar desde /p/TOKEN | ✅ / ❌ | | |
| 4. Abrir Comprar material | ✅ / ❌ | | |
| 5. Seleccionar OBRAMAT Demo | ✅ / ❌ | | |
| 6. Confirmar pedido (checkout_cart) | ✅ / ❌ | | |

#### Métricas IA (anotar manualmente)

| Métrica | Valor |
|---|---|
| IA-01 Tiempo voice-to-quote (s) | |
| IA-02 Materiales detectados | |
| IA-03 Materiales corregidos | |
| IA-04 Sugerencias IA aceptadas | |
| MKT-05 Estrategia auto-select | |
| INS-03 Número de clics hasta pedido | |
| INS-04 Cambios de proveedor | |

#### Flujo proveedor (contacto@inmostay.com)

| Paso | Resultado | Tiempo (s) | Notas |
|---|---|---|---|
| 6. Login → Portal → ver pedido | ✅ / ❌ | | |
| 7. Confirmar pedido | ✅ / ❌ | | |
| 8. Iniciar preparación | ✅ / ❌ | | |
| 9. Marcar como enviado + tracking | ✅ / ❌ | | |

#### Flujo post-envío (legal@inmostay.com)

| Paso | Resultado | Tiempo (s) | Notas |
|---|---|---|---|
| 10. Ver seguimiento de material | ✅ / ❌ | | |
| 11. Confirmar recepción | ✅ / ❌ | | |
| 12. Trabajo desbloqueado | ✅ / ❌ | | |
| 13. Continuar hacia factura | ✅ / ❌ / N/A | | |

#### Estado final (query en Supabase)

```sql
SELECT id, estado, total, created_at FROM trade_marketplace_orders WHERE id = '<ORDER_ID>';
```

Resultado: [pegar salida]

#### Incidencias

| # | Descripción | Acción tomada | SQL ejecutado |
|---|---|---|---|
| | | | |

#### Métricas observadas este ciclo

| Métrica | Valor |
|---|---|
| PRV-01 seg pedido → confirmado | |
| PRV-04 seg pedido → enviado | |
| MKT-06 importe del pedido | |
| MKT-07 número de líneas | |
| ERP-01 trabajo desbloqueado | sí / no |
| CAL-07 incidencias manuales | |

#### Resultado del ciclo

**Estado:** ✅ ÉXITO / ❌ BLOQUEADO / ⚠️ ÉXITO CON INCIDENCIAS  
**Notas para el siguiente ciclo:**

```

---

## Registro de ciclos

### PZ-001 — Flujo completo — PENDIENTE

**Estado:** ⏳ Esperando creación de contacto@inmostay.com y despliegue del fix de routing.

---

### PZ-002 — PENDIENTE

**Estado:** ⏳ Solo tras completar PZ-001.

---

### PZ-003 — PENDIENTE

**Estado:** ⏳ Solo tras completar PZ-002.

---

## Registro de incidencias globales

| Fecha | Ciclo | Tipo | Descripción | Resolución |
|---|---|---|---|---|
| 2026-07-23 | Pre-piloto | SQL | legal@inmostay.com no estaba en trade_org_members → checkout_cart bloqueado | INSERT admin en trade_org_members |
| 2026-07-23 | Pre-piloto | SQL | offerings vacíos → migrados 178 productos de trade_supplier_products | INSERT masivo con match_state=pending_review |
| 2026-07-23 | Pre-piloto | SQL | actor OBRAMAT Demo apuntaba a catálogo vacío ebb930d8 | UPDATE supplier_catalog_id = 280c05e5 |
| 2026-07-23 | Pre-piloto | SQL | supplier_config INSERT fallaba con zona_cobertura inexistente | Eliminada columna del INSERT |
| 2026-07-23 | Pre-piloto | Routing | routeSession() no detectaba usuarios con solo rol proveedor | Fix en App.tsx: check getMyMarketplaceMemberships() |

---

## Registro de cambios mínimos de código durante el piloto

| Fecha | Archivo | Cambio | Motivación |
|---|---|---|---|
| 2026-07-23 | `src/App.tsx` | Check supplier-only en routeSession() | Proveedor sin org aterrizaba en AppDashboard vacío |

---

## Criterios de aprobación de Fase 1 (revisión post PZ-003)

Para continuar a Fase 2 todos deben cumplirse:

| Criterio | Estado |
|---|---|
| Los 3 pedidos PZ-001, PZ-002, PZ-003 alcanzaron `confirmed` | ⏳ |
| 0 errores críticos que bloquearon el flujo | ⏳ |
| Los 3 trabajos se desbloquearon tras `delivered` | ⏳ |
| Sin fuga de datos entre cuentas (query 14 de PILOT_ANALYTICS) | ⏳ |
| CAL-07 incidencias manuales ≤ 1 por ciclo | ⏳ |

---

## Acciones pendientes de pre-piloto

| Acción | Responsable | Estado |
|---|---|---|
| Crear contacto@inmostay.com en Auth (Supabase Dashboard → Invite) | Fernando | ❌ Pendiente |
| Insertar como owner en trade_marketplace_actor_members (SQL post-creación) | Fernando | ❌ Bloqueado |
| Commit + push routing fix (App.tsx) a main y despliegue en Vercel | Fernando | ❌ Pendiente |
| Verificar routing proveedor en producción (login con contacto@inmostay.com) | Fernando | ❌ Bloqueado |

---

## SQL de verificación pre-ciclo (ejecutar antes de cada PZ)

```sql
-- 1. Offerings disponibles
SELECT COUNT(*) AS total_offerings, COUNT(*) FILTER (WHERE stock_disponible) AS con_stock
FROM trade_marketplace_supplier_offerings
WHERE actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5';

-- 2. Actor activo
SELECT id, nombre, estado FROM trade_marketplace_actors
WHERE id = '85e73234-c74e-44e7-865a-1aca8312f9a5';

-- 3. Outbox sin procesar
SELECT COUNT(*) AS pendientes FROM trade_marketplace_outbox
WHERE actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5' AND processed_at IS NULL;

-- 4. legal@inmostay.com en org_members
SELECT m.role, m.activo FROM trade_org_members m
JOIN auth.users u ON u.id = m.user_id
WHERE u.email = 'legal@inmostay.com'
  AND m.org_id = '1047165e-f6ce-4b5a-9141-0d76be0a4a5a';
```

Resultado esperado antes de cada ciclo:
- `total_offerings ≥ 178` y `con_stock > 0`
- `estado = 'active'`
- `pendientes = 0`
- `activo = true`
