# TrabFlow — Backlog Futuro

**Estado de todos los ítems:** APARCADO  
**Regla:** Ningún ítem de este documento se implementa ni planifica hasta que la fase activa en `EXECUTION_BOARD.md` haya terminado y el ítem haya sido evaluado y autorizado explícitamente.

> **"Una idea nueva nunca interrumpe la fase actual. Se registra aquí y se evalúa cuando la fase en curso haya terminado."**

---

## Cómo usar este documento

Cuando durante una sesión de trabajo aparezca una idea, mejora o funcionalidad que no forma parte de la tarea activa:

1. **NO implementar.**
2. **Registrar aquí** con el formato siguiente.
3. **Continuar con la tarea activa.**

Formato de registro:

```
### BF-XXX — Título

**Descripción:** Qué es y qué resuelve.
**Motivo:** Por qué surgió la idea (contexto).
**Impacto:** Qué mejora o desbloquea si se implementa.
**Prioridad:** Alta / Media / Baja
**Fase recomendada:** En qué fase del roadmap encaja.
**Estado:** APARCADO
**Fecha registro:** YYYY-MM-DD
```

---

## IDEAS APARCADAS

---

### BF-001 — Marketplace Internacional

**Descripción:** Extensión del Marketplace a mercados de Portugal e Italia. Proveedores locales, normativa local, idioma local.  
**Motivo:** Visión 2030 del proyecto (doc `06_TRABFLOW_VISION_2030.md`).  
**Impacto:** Expansión del TAM. Requiere localización completa (i18n), proveedores locales, y normativa técnica por país.  
**Prioridad:** Alta (a largo plazo)  
**Fase recomendada:** Fase 7 — Internacionalización (2027–2028)  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

### BF-002 — Stripe Connect (Modelo de Comisión)

**Descripción:** Split de pagos entre TrabFlow y el proveedor usando Stripe Connect. TrabFlow retiene comisión del 2-3% de cada pedido completado.  
**Motivo:** Modelo de negocio documentado en `08_BUSINESS_MODEL.md`. Fuente de ingresos principal a largo plazo.  
**Impacto:** Transforma TrabFlow de SaaS puro a plataforma de comisiones. Requiere piloto con proveedor real validado primero.  
**Prioridad:** Alta (a medio plazo)  
**Fase recomendada:** Fase 5 — Modelo de comisión (Ene–Mar 2027)  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

### BF-003 — Marketplace de Fabricantes

**Descripción:** Integración de fabricantes (Schneider Electric, Roca, Baxi) que pagan por visibilidad en el catálogo. Sus productos aparecen con badge de "fabricante destacado" en las recomendaciones.  
**Motivo:** Canal de ingresos adicional documentado en `07_GO_TO_MARKET.md` (Canal 6 — Partnerships con fabricantes, 2027).  
**Impacto:** Nuevos ingresos sin coste de adquisición. Requiere gestionar conflicto de interés con la imparcialidad del Motor IA.  
**Prioridad:** Media  
**Fase recomendada:** Fase 5–6 (2027)  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

### BF-004 — Integración Logística (Tracking Real de Transportista)

**Descripción:** Integración con APIs de mensajería (SEUR, MRW, DHL) para tracking real del número de seguimiento del paquete. Actualmente el campo existe pero no hay integración real.  
**Motivo:** Detectado en PZ-001A como mejora pendiente para RC-1 (`PZ001A_COMPLETED.md` § 9).  
**Impacto:** El instalador puede ver dónde está exactamente su pedido. Reduce consultas al proveedor.  
**Prioridad:** Baja  
**Fase recomendada:** Sprint 2 Marketplace o posterior  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

### BF-005 — API Pública para ERP de Proveedores (Webhooks)

**Descripción:** API REST (solo lectura en v1) y webhooks para que el ERP del proveedor reciba pedidos automáticamente sin entrar al portal.  
**Motivo:** Documentado en `02_IMPLEMENTATION_MASTER_PLAN.md` (Fase 6 — 2027).  
**Impacto:** Elimina la necesidad de que el proveedor entre al portal para cada pedido. Escala el modelo B2B sin fricción operativa.  
**Prioridad:** Alta (a largo plazo — solo con proveedores con ERP propio)  
**Fase recomendada:** Fase 6 — Red de descubrimiento (Mar–Jun 2027)  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

### BF-006 — Motor IA Predictivo de Demanda

**Descripción:** Predicción de qué materiales necesitará un instalador en función de estacionalidad, historial de trabajos y tipo de oficio. Sugerencias proactivas antes de que el instalador empiece el presupuesto.  
**Motivo:** Siguiente evolución natural del Motor IA una vez consolidado el aprendizaje implícito de proveedores.  
**Impacto:** Reduce el tiempo de presupuesto de 30s a < 10s en casos habituales. Aumenta el uso del Marketplace.  
**Prioridad:** Alta (a largo plazo)  
**Fase recomendada:** Fase 6–7 (2027–2028)  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

### BF-007 — Dashboard BI para Distribuidores

**Descripción:** Panel de Business Intelligence para el proveedor: tendencias de pedidos, materiales más solicitados por zona, comportamiento de sus instaladores clientes, comparativa temporal.  
**Motivo:** Valor diferencial para distribuidores grandes (OBRAMAT, SALTOKI) que necesitan datos de sus clientes instaladores.  
**Impacto:** Convierte TrabFlow Connect en una fuente de inteligencia de mercado, no solo un canal de pedidos. Aumenta el valor percibido del acuerdo con el distribuidor.  
**Prioridad:** Media  
**Fase recomendada:** Fase 6 o posterior. Solo con datos reales de múltiples pilotos.  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

### BF-008 — Sistema de Referidos Instalador → Instalador

**Descripción:** Código de referido único por instalador. El instalador que refiere obtiene descuento. El instalador referido obtiene descuento en el primer mes.  
**Motivo:** Canal de captación orgánica documentado en `07_GO_TO_MARKET.md`. Identificado en `RC1_COMMERCIAL_READINESS.md` como canal más efectivo para instaladores.  
**Impacto:** Captación orgánica de alta calidad (confianza entre pares). Requiere lógica de Stripe (descuentos) y BD (tracking de referidos).  
**Prioridad:** Media  
**Fase recomendada:** Post RC-1. Antes de Sprint 2.  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

### BF-009 — Catálogo Libre Navegable (Marketplace Fase 3)

**Descripción:** El instalador puede explorar el catálogo del Marketplace sin necesidad de un presupuesto previo. Carrito flotante libre. Añadir ítems directamente desde el catálogo.  
**Motivo:** Aprobado en visión 2026-07-27 (`project_marketplace_fase3.md`). No implementado — aplazado a post-pilotos comerciales.  
**Impacto:** Amplía el caso de uso del Marketplace más allá del flujo presupuesto → pedido. El instalador puede hacer pedidos directos sin generar presupuesto.  
**Prioridad:** Alta (a medio plazo)  
**Fase recomendada:** Post-pilotos comerciales. Sprint 3 Marketplace.  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

### BF-010 — Valoraciones de Proveedores Post-Pedido

**Descripción:** Flujo guiado de valoración del proveedor tras confirmar recepción. El instalador puntúa tiempo de respuesta, calidad del producto, y gestión del pedido.  
**Motivo:** Identificado en `PZ001A_COMPLETED.md` como mejora pendiente (§ 9). El campo existe en BD pero no hay UX.  
**Impacto:** Score de proveedor visible en el catálogo. Genera confianza en nuevos proveedores. Base para el sistema de recomendación.  
**Prioridad:** Media  
**Fase recomendada:** Fase 6 — Red de descubrimiento (2027)  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

### BF-011 — App Móvil Nativa (Expo) en Paridad con Web

**Descripción:** Completar la app Expo/React Native para que cubra todos los flujos críticos del instalador de campo: presupuesto por voz, partes de trabajo, seguimiento de material, Marketplace.  
**Motivo:** Documentado como deuda en `02_IMPLEMENTATION_MASTER_PLAN.md`. La app actual tiene solo 9 pantallas. El 70% del uso ocurre en móvil.  
**Impacto:** Desbloquea el segmento de instaladores de campo. Es el gap más visible para el usuario en obra.  
**Prioridad:** Alta  
**Fase recomendada:** 2027 — paralelo a Fase 5  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

### BF-012 — Staging + CI/CD

**Descripción:** Supabase branch o proyecto separado para staging. CI/CD básico en GitHub Actions (build + lint + E2E). Regeneración automática de `supabase.gen.ts`.  
**Motivo:** Deuda técnica documentada en `02_IMPLEMENTATION_MASTER_PLAN.md`. Actualmente toda migración va directo a producción.  
**Impacto:** Elimina el riesgo de que una migración rompa producción. Prerequisito para Sprint 2 Marketplace.  
**Prioridad:** Alta — prerequisito para Sprint 2  
**Fase recomendada:** Antes de Sprint 2 Marketplace  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

### BF-013 — Refactoring AppDashboardView.tsx

**Descripción:** Dividir el monolito de 10.617 líneas en módulos independientes. Extraer cada Screen* a su propio directorio.  
**Motivo:** Deuda técnica estructural documentada en `02_IMPLEMENTATION_MASTER_PLAN.md` y `11_PROJECT_MATURITY_REPORT.md`. Penaliza velocidad de desarrollo y calidad.  
**Impacto:** Reduce el tiempo de onboarding de nuevos desarrolladores. Facilita la detección de bugs. Prerequisito para escala del equipo.  
**Prioridad:** Alta (a medio plazo)  
**Fase recomendada:** Post-PMF. No durante RC-1.  
**Estado:** APARCADO  
**Fecha registro:** 2026-07-28

---

*Este documento es un parking, no un roadmap. Los ítems aquí registrados no tienen fecha de implementación hasta autorización explícita.*
