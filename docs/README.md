# TrabFlow — Documentación del Proyecto

**Última actualización:** Julio 2026  
**Estado:** RC-1 en curso. Consultar EXECUTION_BOARD antes de cualquier acción.

---

## ⚡ Antes de comenzar cualquier desarrollo

```
  README  →  EXECUTION_BOARD  →  MASTER ROADMAP  →  resto
```

**[EXECUTION_BOARD.md](EXECUTION_BOARD.md)** es el único documento que indica dónde está el proyecto hoy, cuál es la tarea activa y qué está bloqueado. Nadie debe empezar a desarrollar sin haberlo consultado primero.

> Cualquier desarrollador que se incorpore al proyecto debe poder determinar la siguiente tarea en menos de 5 minutos leyendo el EXECUTION_BOARD.

---

## Jerarquía documental

| Tipo | Documentos | Frecuencia de cambio |
|------|-----------|---------------------|
| **Control** | EXECUTION_BOARD, BACKLOG_FUTURO, CHANGELOG | Cada sesión |
| **Estratégicos** | Constitución, Visión 2030, Business Model, GTM, Competitive Moat, Arquitectura, Master Roadmap | Rara vez |
| **Técnicos** | ADR, Supabase Guide, Motor IA docs, Marketplace docs | Por sprint |
| **Ejecución** | PZ Reports, RC Reports, Sprint Reports | Por piloto/sprint |

---

## Índice general

### Documentación normativa técnica (julio 2026)

| Documento | Descripción |
|---|---|
| [00_MASTER_ROADMAP.md](00_MASTER_ROADMAP.md) | Visión, objetivos 2026–2028, estado actual, roadmap completo, riesgos |
| [01_TRABFLOW_CONSTITUTION.md](01_TRABFLOW_CONSTITUTION.md) | Principios arquitectónicos, reglas de BD, seguridad, UX, IA, Marketplace, ADR |
| [02_IMPLEMENTATION_MASTER_PLAN.md](02_IMPLEMENTATION_MASTER_PLAN.md) | Qué queda por desarrollar, en qué orden y por qué — por fases |
| [03_PRODUCT_ROADMAP.md](03_PRODUCT_ROADMAP.md) | Estado y roadmap por dominio: ERP, Marketplace, IA, Mobile, Analytics... |
| [04_SYSTEM_ARCHITECTURE.md](04_SYSTEM_ARCHITECTURE.md) | Mapa completo: tablas, RPCs, Edge Functions, flujos de datos, diagramas Mermaid |
| [05_DEMO_AND_PILOT_GUIDE.md](05_DEMO_AND_PILOT_GUIDE.md) | Cómo preparar y ejecutar demos comerciales y pilotos con proveedores |

---

### Documentación estratégica (julio 2026)

| Documento | Descripción |
|---|---|
| [06_TRABFLOW_VISION_2030.md](06_TRABFLOW_VISION_2030.md) | Por qué existe TrabFlow, misión, visión 2030, principios irrompibles |
| [07_GO_TO_MARKET.md](07_GO_TO_MARKET.md) | Estrategia comercial completa: segmentos, canales, 0→10.000 usuarios, pilotos |
| [08_BUSINESS_MODEL.md](08_BUSINESS_MODEL.md) | Todos los flujos de ingresos, proyecciones ilustrativas, cuándo buscar inversión |
| [09_COMPETITIVE_MOAT.md](09_COMPETITIVE_MOAT.md) | Análisis honesto de ventajas vs Holded, STEL Order, Amazon Business |
| [10_INVESTOR_PARTNER_PLAYBOOK.md](10_INVESTOR_PARTNER_PLAYBOOK.md) | Para distribuidores, asociaciones, fabricantes, e inversores |
| [11_PROJECT_MATURITY_REPORT.md](11_PROJECT_MATURITY_REPORT.md) | Evaluación CTO externo: 12 dimensiones 0–10, SWOT, veredicto para pilotos |

---

### Design System y Product Language

| Documento | Descripción |
|---|---|
| [design-system/DESIGN_SYSTEM_v1.md](design-system/DESIGN_SYSTEM_v1.md) | Paleta, tipografía, espaciado, componentes, dark mode, accesibilidad |
| [design-system/PRODUCT_LANGUAGE_v1.md](design-system/PRODUCT_LANGUAGE_v1.md) | Terminología oficial — qué decir y qué no decir en la interfaz |

---

### Architecture Decision Records

| ADR | Decisión | Estado |
|---|---|---|
| [adr/ADR-001-realtime-portal-proveedor.md](adr/ADR-001-realtime-portal-proveedor.md) | Realtime en PortalPedidos diferido hasta confirmar `supplier_actor_id` en RLS | Aceptado |

---

### Motor IA

| Documento | Descripción |
|---|---|
| [ai-engine/README.md](ai-engine/README.md) | Documentación técnica del motor `trade-voice-to-quote` |
| [ai-engine/CHANGELOG.md](ai-engine/CHANGELOG.md) | Historial de versiones — v59 en producción (98.2% OK rate) |
| [ai-engine/BENCHMARK_SYSTEM_DESIGN.md](ai-engine/BENCHMARK_SYSTEM_DESIGN.md) | Metodología del benchmark oficial de 400 casos |
| [ai-engine/PROMOTION_CRITERIA.md](ai-engine/PROMOTION_CRITERIA.md) | Criterios para promover una versión del motor a producción |
| [ai-engine/SPRINT4_PLAN.md](ai-engine/SPRINT4_PLAN.md) | Plan del Sprint 4: observabilidad, regression diff, SLA |

---

### Marketplace (TrabFlow Connect)

| Documento | Descripción |
|---|---|
| [marketplace/README.md](marketplace/README.md) | Documentación general del Marketplace B2B |
| [marketplace/TRABFLOW_CONNECT_REVISED_PLAN.md](marketplace/TRABFLOW_CONNECT_REVISED_PLAN.md) | Plan revisado basado en auditoría del código real (v2.0) |
| [marketplace/MARKETPLACE_IMPLEMENTATION_ROADMAP.md](marketplace/MARKETPLACE_IMPLEMENTATION_ROADMAP.md) | Roadmap de implementación técnica |

---

### Demo y comercial

| Documento | Descripción |
|---|---|
| [demo/DEMO_COMERCIAL_v1.md](demo/DEMO_COMERCIAL_v1.md) | Guión de demo para distribuidores (OBRAMAT, SALTOKI, SONEPAR) |

---

### Documentación histórica (referencia)

| Documento | Descripción |
|---|---|
| [TRADEFLOW_OS.md](TRADEFLOW_OS.md) | Manual de funcionamiento de la empresa — visión, misión, valores, estrategia comercial |
| [AUDITORIA_TECNICA_COMPLETA_v2.md](AUDITORIA_TECNICA_COMPLETA_v2.md) | Auditoría técnica completa (jun 2026) |
| [TrabFlow_AnalisisCompleto_v3_Junio2026.md](TrabFlow_AnalisisCompleto_v3_Junio2026.md) | Análisis completo de la app (jun 2026) |
| [TradeFlow_Plan_Implementacion.md](TradeFlow_Plan_Implementacion.md) | Plan de implementación por fases (may 2026) |
| [TradeFlow_Supabase_Guide.md](TradeFlow_Supabase_Guide.md) | Guía de implementación Supabase |
| [analisis-multi-perfil.md](analisis-multi-perfil.md) | Análisis del sistema multi-perfil (jun 2026) |
| [analisis-subcontratas.md](analisis-subcontratas.md) | Módulo de subcontratas (jun 2026) |

---

### Gobierno del proyecto (leer primero)

| Documento | Descripción |
|---|---|
| [EXECUTION_BOARD.md](EXECUTION_BOARD.md) | **ÚNICO PUNTO DE CONTROL** — Estado actual, tarea activa, cola, dependencias, reglas |
| [BACKLOG_FUTURO.md](BACKLOG_FUTURO.md) | Ideas aparcadas — no planificadas, no implementar hasta autorización |

### RC-1 — Commercial Readiness

| Documento | Descripción |
|---|---|
| [RC1_COMMERCIAL_READINESS.md](RC1_COMMERCIAL_READINESS.md) | Auditoría comercial completa: qué está listo, qué falta, qué eliminar — 15 secciones |
| [RC1_CHECKLIST.md](RC1_CHECKLIST.md) | Checklist comercial ejecutable — 14 bloques, ~100 ítems priorizados |
| [RC1_MVP_ELEMENTS.md](RC1_MVP_ELEMENTS.md) | Elementos con aspecto MVP + plan priorizado por impacto comercial (CRÍTICO/ALTO/MEDIO/BAJO) |

---

### Pilot Zero

| Documento | Descripción |
|---|---|
| [pilot/PZ001A_COMPLETED.md](pilot/PZ001A_COMPLETED.md) | Cierre oficial PZ-001A — flujo validado, bugs, UX, tiempos, plan PZ-001B/C/D/E |
| [pilot/PZ001_REPORT.md](pilot/PZ001_REPORT.md) | Métricas reales del piloto — 2 pedidos completados, tiempos observados |
| [pilot/PZ001_BUGLOG.md](pilot/PZ001_BUGLOG.md) | 11 bugs encontrados y resueltos durante PZ-001A |
| [pilot/PZ001_UX.md](pilot/PZ001_UX.md) | 5 mejoras UX identificadas y resueltas durante PZ-001A |
| [pilot/PZ001_EXECUTION.md](pilot/PZ001_EXECUTION.md) | Checklist de ejecución de 20 pasos |

---

## Estado del producto (julio 2026)

```
✅ ERP completo en producción
✅ Motor IA v59 — 98.2% OK rate — 400 casos benchmark
✅ Marketplace Phase 2 completa (checkout, seguimiento, portal proveedor)
✅ Design System v1 y Product Language v1
✅ PZ-001A completado — 2 ciclos de pedido E2E validados
🔧 RC-1 Commercial Readiness — activo
📋 PZ-001B — primer piloto con instalador externo real (pendiente RC1-Alpha)
📋 Sprint 2 Marketplace — Realtime, registro auto, email (pendiente post RC-1)
📋 Modelo de comisión Stripe Connect (2027)
```

---

## Reglas de uso de esta documentación

1. **Los documentos normativos (00–05) son la referencia antes de cualquier decisión técnica o de producto.** Si la realidad del código contradice un documento, el documento necesita actualizarse — no ignorarse. Los documentos estratégicos (06–11) son la referencia para decisiones comerciales, de producto, y de inversión.

2. **Los ADR son inmutables.** Una decisión documentada en un ADR no se revierte sin escribir un nuevo ADR que la reemplace.

3. **El Design System y el Product Language son obligatorios** en toda pantalla nueva. No copiar clases de Tailwind manualmente si existe un token. No inventar términos si están definidos en PRODUCT_LANGUAGE_v1.md.

4. **La Constitución (01) rige la arquitectura.** Cualquier excepción a sus reglas requiere un ADR.

5. **Esta documentación se actualiza al cierre de cada sprint**, no durante. La actualización la hace quien cierra el sprint.
