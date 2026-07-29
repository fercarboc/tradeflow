# PILOT_ZERO_PLAN — Plan de Ejecución

**Versión:** 1.0 — Julio 2026  
**Estado:** COMPLETADO — ver [docs/pilot/PZ001A_COMPLETED.md](pilot/PZ001A_COMPLETED.md)  
**Objetivo:** Ejecutar el primer ciclo real completo entre un instalador y un proveedor usando el entorno Vercel desplegado.

---

## Resumen ejecutivo

El Pilot Zero es el primer ciclo de uso real controlado de TrabFlow. Se ejecuta sobre el entorno de producción en Vercel + Supabase actual, con cuentas identificadas como piloto. No es una simulación — los datos fluyen por el sistema real.

### Cuentas del piloto

| Rol | Email | Estado |
|---|---|---|
| Instalador (ERP) | legal@inmostay.com | ✅ Existe — org "angel ameteo" (empresa_plus) |
| Proveedor (Portal) | contacto@inmostay.com | ❌ **PENDIENTE CREACIÓN MANUAL** |

### Actores y recursos configurados

| Recurso | ID | Estado |
|---|---|---|
| Org instaladora | `1047165e-f6ce-4b5a-9141-0d76be0a4a5a` | ✅ Activa |
| Actor Marketplace OBRAMAT Demo | `85e73234-c74e-44e7-865a-1aca8312f9a5` | ✅ Activo |
| Catálogo OBRAMAT (legacy) | `280c05e5-7590-4ca1-82d0-fc8977a919d8` | ✅ 178 productos |
| Offerings en Marketplace | 178 | ✅ match_state = pending_review |
| Supplier config (portes) | 8.50€ / gratis ≥150€ / 3 días | ✅ Configurado |
| legal@inmostay.com en trade_org_members | admin | ✅ Añadido |

---

## Acción previa bloqueante — Creación de contacto@inmostay.com

**Esta acción es manual. Sin ella el Pilot Zero no puede ejecutarse.**

### Opción A — Supabase Dashboard (recomendada)

1. Abrir [https://supabase.com/dashboard/project/dqqjaujnulutinskmqsu/auth/users](https://supabase.com/dashboard/project/dqqjaujnulutinskmqsu/auth/users)
2. Clic en **"Invite user"**
3. Email: `contacto@inmostay.com`
4. Clic en **"Send invitation"**
5. El usuario recibirá un email de invitación para establecer contraseña
6. Confirmar que aparece en la lista con estado "invited"

### Opción B — Flujo /registro en la app

1. Abrir [https://tradeflow.vercel.app/registro](la URL del proyecto en Vercel)
2. Completar el registro con email `contacto@inmostay.com`
3. Completar el onboarding (no se usará el ERP de esta cuenta, solo el Portal)

### Después de la creación (ejecutado por el equipo técnico)

Una vez que `contacto@inmostay.com` exista en auth.users, ejecutar en Supabase:

```sql
-- Obtener el user_id del nuevo usuario
SELECT id FROM auth.users WHERE email = 'contacto@inmostay.com';

-- Añadir como owner del actor OBRAMAT Demo
INSERT INTO trade_marketplace_actor_members (
  actor_id, user_id, role_id, activo, accepted_at
) VALUES (
  '85e73234-c74e-44e7-865a-1aca8312f9a5',
  '<USER_ID_OBTENIDO>',
  '35a666b9-75a6-43ad-9816-8adba785adda', -- role: owner (supplier)
  true,
  now()
);
```

---

## Identificación de datos del piloto

Los datos del Pilot Zero se identifican por:

- **Org ID:** `1047165e-f6ce-4b5a-9141-0d76be0a4a5a` (tag: "angel ameteo")
- **Actor ID:** `85e73234-c74e-44e7-865a-1aca8312f9a5` (metadata: `is_pilot_zero=true`)
- **Emails conocidos:** `legal@inmostay.com`, `contacto@inmostay.com`
- **metadata en offerings:** `source = 'legacy_migration_pilot_zero'`, `pilot_id = 'PZ'`

**Exclusión de métricas comerciales:** Cualquier KPI de negocio (MRR, GMV, conversión) debe excluir org_id = `1047165e` y actor_id = `85e73234`.

---

## Criterio de éxito

### Fase 1 — Validación técnica (3 ciclos)

Ejecutar 3 ciclos PZ-001, PZ-002, PZ-003. Criterio de aprobación:
- 0 errores críticos que bloqueen el flujo
- Los 3 pedidos alcanzan estado `confirmed`
- Los 3 trabajos se desbloquean tras `delivered`
- Sin fuga de datos entre cuentas

### Fase 2 — Estabilidad (22 ciclos adicionales)

Solo tras aprobación de Fase 1. Criterio de aprobación:
- 0 errores críticos en los 25 ciclos totales
- 100% de pedidos trazables con eventos de estado
- Tiempo de compra habitual < 20s con datos preparados
- Tiempo de gestión del proveedor < 10s por acción

---

## Escenarios planificados

### Escenario A — Flujo completo (PZ-001 a PZ-025)

```
legal@inmostay.com:
  1. Crear presupuesto por voz (IA)
  2. Guardar y enviar al cliente
  3. Aceptar desde vista pública (/p/TOKEN)
  4. Abrir Comprar material → seleccionar OBRAMAT Demo
  5. Confirmar pedido (checkout_cart)

contacto@inmostay.com:
  6. Portal → ver nuevo pedido (tab Pedidos)
  7. Confirmar pedido (confirm_supplier_order)
  8. Iniciar preparación (prepare_marketplace_order)
  9. Marcar como enviado + tracking (ship_supplier_order)

legal@inmostay.com:
  10. Ver tracking en Seguimiento de material
  11. Confirmar recepción (deliver_marketplace_order)
  12. Verificar que el trabajo se desbloquea
  13. Continuar hacia factura si procede
```

### Escenario B — Cambio de proveedor manual

Desde StepComparar: seleccionar proveedor alternativo, verificar que se registra la preferencia.

### Escenario C — Sin stock

1. Desde Portal, contacto@inmostay.com marca una referencia como sin stock (`stock_disponible = false`)
2. Verificar que deja de aparecer como primera opción al instalador
3. Verificar mensaje o advertencia en el checkout

### Escenario D — Cancelación

Cancelar pedido en estado `pending` o `confirmed`. Verificar:
- Estado → `cancelled`
- Evento en `trade_marketplace_order_events`
- Notificación en `trade_marketplace_outbox`
- Sin reserva de stock bloqueada

### Escenario E — Error controlado

Intentar confirmar un pedido ya confirmado o cancelado. Verificar:
- Error claro al usuario
- Sin estado inconsistente
- Log de error disponible

---

## Identificadores de ciclo

```
PZ-001 / PZ-002 / PZ-003    → Fase 1 (validación)
PZ-004 ... PZ-025            → Fase 2 (estabilidad, solo tras aprobación)
```

Cada ciclo se registra en el Runbook (`PILOT_ZERO_RUNBOOK.md`).

---

## Cronograma estimado

| Actividad | Cuándo |
|---|---|
| Creación contacto@inmostay.com | Inmediato (manual) |
| Vinculación al actor OBRAMAT Demo | Tras creación (SQL) |
| Despliegue fix routing en Vercel | Tras merge del PR |
| PZ-001 | Primer día hábil tras despliegue |
| PZ-002 y PZ-003 | Mismo día o siguiente |
| Informe Fase 1 | Tras PZ-003 |
| Decisión de continuar con Fase 2 | Tras revisión del informe |

---

## Límites del Pilot Zero

No se implementará durante el Pilot Zero:
- Fabricantes, Marketplace público, Stripe Connect, comisiones
- Smart Inventory, API pública, valoraciones de proveedor
- Envío parcial, logística avanzada, nuevos modelos de IA
- Refactors no relacionados con el flujo del piloto
