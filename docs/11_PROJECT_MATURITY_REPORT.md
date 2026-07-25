# TrabFlow — Project Maturity Report

**Fecha:** Julio 2026  
**Evaluador:** CTO externo (evaluación independiente basada en análisis del repositorio)  
**Metodología:** Análisis directo del código fuente, migraciones, documentación, y arquitectura. No es una evaluación de percepción — es una evaluación de evidencia.  
**Propósito:** Determinar si TrabFlow está preparado para iniciar pilotos comerciales con distribuidores y asociaciones antes de abrir Sprint 2.

---

## Resumen ejecutivo

TrabFlow es un proyecto técnicamente ambicioso con un núcleo de producto válido. El motor IA está validado empíricamente. El Marketplace tiene las tres fases de UX completadas. El ERP cubre el ciclo completo del instalador. Sin embargo, el proyecto arrastra deuda técnica estructural que limitará la velocidad de desarrollo en los próximos sprints si no se aborda. La preparación para pilotos comerciales es condicional — el producto funciona, pero la consolidación UX pendiente es un prerequisito legítimo antes de mostrarlo a distribuidores reales.

**Veredicto:** TrabFlow está en condiciones de iniciar un piloto técnico controlado con un distribuidor antes de abrir Sprint 2, con la condición de que la consolidación UX cierre primero. No está en condiciones de escalar sin resolver la deuda de infraestructura (staging, CI/CD, tipos generados).

---

## Puntuaciones por dominio

### 1. Arquitectura — 5.5 / 10

**Fortalezas:**
- Stack moderno y coherente (React 19 + TypeScript + Supabase + Vite + Tailwind)
- RLS correctamente implementada en todas las tablas críticas
- Edge Functions para lógica sensible fuera del cliente
- Outbox pattern para notificaciones asíncronas
- Design System con tokens centralizados

**Debilidades:**
- `AppDashboardView.tsx` con 10.617 líneas. Es el mayor riesgo de arquitectura del proyecto. Cualquier bug en el dashboard requiere navegar 10.000 líneas. Cualquier nuevo desarrollador tarda semanas en entender la estructura.
- `src/lib/supabase.ts` con 3.987 líneas mezclando inicialización del cliente y lógica de negocio.
- `supabase.gen.ts` desactualizado — 67 instancias de `as any` en el código del Marketplace. TypeScript pierde su función principal: detectar errores en tiempo de compilación.
- Sin staging separado de producción. Toda migración va directo a prod. Es el riesgo más inmediato antes de Sprint 2.
- Sin CI/CD. No hay validación automática antes de despliegue.
- `search_path` bug documentado en la Constitución — las funciones SECURITY DEFINER deben usar `public.tabla`. Riesgo latente si no se audita exhaustivamente.

**Recomendación:** Crear Supabase branch para staging y configurar CI/CD básico antes de Sprint 2. Regenerar `supabase.gen.ts` y eliminar los `as any`. El monolito de `AppDashboardView.tsx` puede esperar — es deuda de mantenimiento, no de seguridad.

---

### 2. Producto — 7 / 10

**Fortalezas:**
- Cobertura funcional completa del ciclo del instalador (presupuesto → cliente → material → técnico → factura)
- Motor IA validado con benchmark empírico de 400 casos
- Marketplace con las tres fases funcionales
- Contratos de mantenimiento SAT con facturación automática
- Asistente de normativa técnica con contenido real

**Debilidades:**
- App móvil con cobertura mínima (9 pantallas en Expo). El instalador en obra no puede usar el grueso del producto en móvil.
- La vista del técnico de campo (`ScreenWorkerView`) tiene capacidades limitadas para el técnico que está en obra.
- Normativa pendiente: CTE DB-SE, DB-SUA, DB-HR, guías IDAE. Promete cubrirlas pero no están.
- Partidas sin oficio en seeds (`undefined_b1.sql`, `undefined_b2.sql`) — calidad de catálogo degradada para algunos oficios.

**Recomendación:** Antes de escalar usuarios, cerrar la brecha de la app móvil para los flujos de campo: voz, partes de trabajo, y seguimiento de material. Es el gap más visible para el instalador en obra.

---

### 3. UX — 6 / 10

**Fortalezas:**
- Design System v1 con tokens centralizados (`src/design-system/index.ts`)
- Product Language v1 definido y documentado
- Componentes compartidos accesibles (`OrderStatusBadge`, `OrderTimeline`, `ConfirmModal`)
- Dark mode implementado en los módulos nuevos
- Accesibilidad ARIA implementada en el Marketplace

**Debilidades:**
- La consolidación UX está activa — no todas las pantallas usan los tokens del Design System.
- El monolito `AppDashboardView.tsx` hace imposible la consistencia visual sin un esfuerzo manual de revisión completa.
- La app tiene inconsistencias de lenguaje en módulos más antiguos donde el Product Language no se ha aplicado todavía.
- La demo interactiva sin login existe pero no está integrada en el flujo comercial de forma sistemática.

**Recomendación:** Cerrar la consolidación UX antes de cualquier demo con proveedor real. Un proveedor que ve términos técnicos en inglés o estados mal etiquetados pierde confianza en el producto.

---

### 4. Escalabilidad — 5 / 10

**Fortalezas:**
- Supabase escala bien hasta ~10.000 usuarios concurrentes sin cambio de infraestructura
- Edge Functions escalan horizontalmente en Vercel/Deno
- Outbox pattern evita cuellos de botella en notificaciones
- RLS garantiza aislamiento de datos sin lógica en el cliente

**Debilidades:**
- Sin staging, no es posible probar el impacto de migraciones en producción antes de ejecutarlas.
- Sin CI/CD, cada despliegue es manual y susceptible de error.
- El monolito `AppDashboardView.tsx` crea problemas de performance en el bundle — el código splitting parcial no compensa el tamaño total.
- El motor IA tiene latencia P95 de 30.6s en benchmark (en umbral de alerta). En producción con más usuarios concurrentes, puede empeorar.
- No hay instrumentación de producción (sin observabilidad de latencia, errores, o uso de funciones en tiempo real). Problema detectado en Sprint 4 P3 pero no resuelto aún.

**Recomendación:** Staging y CI/CD son prerequisitos de Sprint 2, no opcionales. Sin ellos, el primer proveedor real puede encontrar un bug que iría a producción directamente.

---

### 5. Seguridad — 7 / 10

**Fortalezas:**
- RLS habilitada y auditada en todas las tablas críticas
- Hardening junio 2026: REVOKE EXECUTE en funciones SECURITY DEFINER para `anon`
- Tokens UUID para vistas públicas (presupuesto, factura, parte, valoración)
- Secrets fuera del repositorio (env vars en Edge Functions)
- Funciones SECURITY DEFINER con `public.tabla` para evitar el bug de `search_path`
- Roles y permisos correctamente implementados en el cliente (`usePermissions.ts`)

**Debilidades:**
- `e2e/.auth/owner.json` y `tech.json` — sesiones de Playwright que pueden estar bajo control de versiones. Riesgo de seguridad menor pero real.
- `apply_scheduled_plan_if_due` captura excepciones en catch vacío — errores de billing silenciados.
- Latencia P95 del motor IA en umbral de alerta (30.6s) — no hay timeout explícito en el cliente. Si el servidor tarda 48s, el cliente espera indefinidamente.
- No hay rate limiting explícito en las RPCs de Marketplace desde el cliente (depende del RLS, no de rate limiting).

**Recomendación:** Verificar el `.gitignore` de `e2e/.auth/`. Añadir timeout de cliente en el motor IA (máximo 45s, con error informativo). Añadir logging en el catch de billing.

---

### 6. Marketplace — 7 / 10

**Fortalezas:**
- Las tres fases de UX completadas y en producción
- Checkout en 2 pasos con auto-selección funcional
- Seguimiento en tiempo real (Realtime) para el instalador
- Portal del proveedor con gestión completa de pedidos
- ADR-001 documenta correctamente la decisión de diferir Realtime en el portal
- Ciclo de vida del pedido completo (pending → confirmed → preparing → shipped → delivered)

**Debilidades:**
- No hay Realtime en el portal del proveedor (ADR-001). El proveedor tiene que recargar para ver nuevos pedidos.
- Sin notificación email al proveedor cuando llega un pedido — el proveedor tiene que entrar al portal para enterarse.
- Sin registro auto-gestionado de proveedores. El proceso de alta es manual.
- Sin modelo de comisión (Stripe Connect no existe). Los pedidos actuales no generan ingresos por transacción.
- La RPC `get_supplier_orders_unified` mezcla pedidos legacy y marketplace — complejidad que limita el filtrado en Realtime (ver ADR-001).

**Recomendación:** Para el primer piloto, el estado actual es suficiente si el proveedor tiene al menos una persona gestionando el portal. Sprint 2 debe resolver el email de notificación y el Realtime como mínimo.

---

### 7. Motor IA — 8 / 10

**Fortalezas:**
- Versión v59 en producción con 98.2% de presupuestos generados correctamente (400 casos benchmark)
- TRUNCADO = 0 en benchmark (era el problema principal de v58)
- Proceso de promoción documentado con criterios empíricos
- Versioning completo con baseline, production, release-candidate, y rollback
- AI Validation Center en el admin panel
- Base de conocimiento de 20+ oficios construida con conocimiento real del sector
- Aprendizaje implícito de preferencias del instalador

**Debilidades:**
- Latencia P95 en benchmark: 30.6s — en umbral de alerta. Monitorización en producción pendiente (Sprint 4 P3).
- 1 VACÍO residual irreducible con el modelo actual (pos.374, reforma compleja, 8192 tokens = límite de Claude Haiku 4.5). Resolución requiere optimización de contexto en Sprint 5.
- Sin dashboard de observabilidad en producción (Sprint 4 P3 pendiente) — no se sabe si el comportamiento en producción real coincide con el benchmark.
- Sin Regression Diff (Sprint 4 P2 pendiente) — cualquier cambio de prompt requiere un análisis manual de los 400 casos.
- Oficio no detectado correctamente en el 21.5% de los casos benchmark — puede mejorarse con análisis de patrones (Sprint 4 P4).

**Recomendación:** Es el módulo más sólido del proyecto. La prioridad es completar P2 (Regression Diff) para poder hacer cambios con seguridad. El VACÍO residual en pos.374 es aceptado formalmente — documentar la excepción en la comunicación con instaladores (el sistema puede pedir que el usuario complete manualmente en casos de reforma muy compleja).

---

### 8. Modelo de negocio — 5 / 10

**Fortalezas:**
- Múltiples flujos de ingreso identificados y secuenciados correctamente
- El modelo de suscripción está implementado y funciona
- El trial de 3 meses reduce la fricción de entrada
- Los planes están bien diseñados — desbloquean valor real progresivamente
- El Marketplace añade un flujo de ingresos no dependiente de las suscripciones

**Debilidades:**
- No hay datos validados de precio, retención, ni CAC/LTV. La base del modelo es hipótesis, no evidencia.
- Sin clientes de pago confirmados públicamente al momento de esta evaluación. **PENDIENTE DE VALIDACIÓN.**
- El GMV del Marketplace es cero hasta que el modelo de comisión esté implementado (Stripe Connect no existe).
- El precio objetivo (29–49€/mes) no está validado — es posible que el mercado soporte más o que rechace ese rango.
- La monetización de distribuidores y fabricantes es un plan bien razonado pero sin ningún dato que lo soporte todavía.

**Recomendación:** La prioridad número uno del Go To Market es conseguir 20 clientes de pago con historial de retención y calcular CAC, LTV, y precio promedio. Sin esos datos, cualquier proyección financiera es especulación.

---

### 9. Go To Market — 5 / 10

**Fortalezas:**
- Estrategia clara y coherente con los recursos disponibles
- Canales correctamente priorizados (boca a boca primero, asociaciones segundo, distribuidores tercero)
- Demo comercial preparada con guión y checklist
- Demo interactiva sin login disponible en la web
- Demo de partner (PartnerDemoView) para distribuidores

**Debilidades:**
- Sin datos reales de ningún canal. No se sabe qué convierte.
- No hay proceso de onboarding documentado para el instalador que se registra solo.
- Sin contenido orgánico activo (no hay YouTube, Instagram, ni blog publicados todavía).
- El primer acuerdo con asociación no está iniciado.
- El primer piloto con distribuidor está en preparación pero no iniciado.

**Recomendación:** El Go To Market es el mayor gap del proyecto en términos de ejecución (no de plan). El plan es sólido — la ejecución requiere salir al mercado con urgencia. Cada semana sin instaladores reales usando el producto es una semana sin datos para validar.

---

### 10. Preparación para pilotos comerciales — 6 / 10

**Fortalezas:**
- El producto hace lo que promete
- La demo puede ejecutarse de principio a fin
- El portal del proveedor permite gestionar pedidos sin formación técnica avanzada
- La guía de demo (05_DEMO_AND_PILOT_GUIDE.md) está documentada con scripts y checklist
- El proceso de carga de catálogo está implementado y testado

**Debilidades:**
- La consolidación UX está activa — hay pantallas con inconsistencias visuales que reducen la credibilidad en una demo
- Sin notificación email al proveedor (el proveedor tiene que entrar al portal para ver los pedidos) — en un piloto real, esto puede causar pedidos sin respuesta
- Sin staging — si hay que resetear el estado del piloto, se hace en producción
- El script de reset de demo está documentado pero requiere acceso a la base de datos

**Recomendación condicional:** El primer piloto técnico puede iniciarse al cerrar la consolidación UX. Requiere tener al menos un contacto en el distribuidor que se comprometa a revisar el portal diariamente. El email de notificación debería implementarse en Sprint 2 antes de escalar el piloto.

---

### 11. Preparación para inversión — 4 / 10

**Fortalezas:**
- El producto es real y funciona
- El motor IA tiene validación empírica que pocos competidores pueden mostrar
- La arquitectura técnica es coherente
- La documentación estratégica (docs 00–11) está disponible para presentar el proyecto

**Debilidades:**
- Sin métricas de negocio validadas (precio, retención, CAC, LTV)
- Sin clientes de pago confirmados
- Sin acuerdo firmado con asociación ni distribuidor
- Sin un segundo desarrollador — el proyecto tiene dependencia crítica de una sola persona
- La deuda técnica (monolitos, sin CI/CD, sin staging) puede generar preguntas difíciles en due diligence

**Recomendación:** No buscar financiación antes de Q1 2027. El benchmark técnico es una ventaja, pero los inversores de seed necesitan tracción comercial, no solo validación técnica. 3–6 meses de datos de retención y precio transforman la conversación.

---

### 12. Preparación para internacionalización — 3 / 10

**Fortalezas:**
- La arquitectura de Supabase y Edge Functions no tiene dependencias geográficas fuertes
- El motor IA puede ser reentrenado en otro idioma con la misma metodología

**Debilidades:**
- Toda la normativa técnica está en español (REBT, RITE, CTE, AEAT, SS españolas)
- El motor IA está entrenado en español con vocabulario español
- La base de conocimiento de partidas (`trade_actuaciones`) usa denominaciones españolas
- La app no tiene internacionalización (i18n) — todos los textos están hardcodeados en español
- Los distribuidores integrados son españoles
- Sin proceso ni plan técnico de internacionalización

**Recomendación:** La internacionalización es un proyecto de 6–12 meses cuando llegue el momento. Diseñarlo en 2027 cuando haya tracción española consolidada. No antes.

---

## Fortalezas del proyecto

1. **Motor IA diferencial.** El 98.2% de OK rate en un benchmark de 400 casos es una validación empírica que pocas startups tienen en el mercado europeo. No es una promesa — es una medición.

2. **Velocidad de ejecución.** El volumen de funcionalidades implementadas por una sola persona es notable. El ERP, el Marketplace, el Motor IA, el portal del proveedor, los contratos de mantenimiento, el asistente técnico — todo en producción.

3. **Integración vertical única.** Ningún competidor conecta los cinco eslabones del flujo del instalador en un solo producto.

4. **Documentación estratégica sólida.** La constitución técnica, el design system, el product language, y los ADRs demuestran pensamiento arquitectural, no solo código rápido.

5. **El Marketplace Phase 2 está completo.** Checkout, seguimiento realtime, portal de proveedor — todas las piezas están en producción.

---

## Debilidades del proyecto

1. **Sin datos de mercado validados.** El mayor riesgo no es técnico. Es no saber si el mercado paga y cuánto. Esta debilidad requiere urgencia en la captación de los primeros 50 clientes de pago.

2. **Monolito en AppDashboardView.tsx.** 10.617 líneas es insostenible a medida que crezca el equipo. Añadir un segundo desarrollador sin refactorizar será costoso.

3. **Sin staging ni CI/CD.** Cada sprint implica riesgo de producción directo. Esto es aceptable en fase muy temprana pero se convierte en un bloqueador serio cuando hay clientes pagadores que no pueden permitirse downtime.

4. **App móvil insuficiente.** El instalador en obra es el cliente principal y no puede usar el 70% del producto desde su móvil.

5. **Dependencia de una sola persona.** El bus factor es 1. Si Fernando no puede trabajar una semana, el proyecto se detiene.

---

## Riesgos

| Riesgo | Probabilidad | Impacto | Estado |
|---|---|---|---|
| El mercado no paga el precio esperado | Media | Crítico | Sin datos todavía |
| Bug en producción sin staging ni CI/CD | Alta | Alto | Activo |
| Latencia P95 motor IA supera 30s en producción | Media | Alto | Monitorización pendiente |
| Un proveedor en piloto no responde pedidos por falta de notificación email | Alta | Alto | Sprint 2 |
| Tipo generado desactualizado causa bug silencioso en producción | Media | Alto | Deuda activa |
| Deuda de `AppDashboardView.tsx` genera bug regresivo en módulo existente | Media | Medio | Deuda activa |
| Churn en mes 4 (fin de trial) por falta de activación | Alta | Crítico | Sin datos |

---

## Oportunidades

1. **El timing es correcto.** El sector de las instalaciones técnicas está en proceso de digitalización forzada por normativa y expectativas de clientes. TrabFlow puede llegar antes de que se consolide un líder.

2. **La IA como barrera.** La competencia tiene 12–18 meses de ventaja técnica que superar. El tiempo es un activo.

3. **El Marketplace como flywheel.** Si el primer piloto funciona, el efecto de red del Marketplace puede convertirse en el motor de crecimiento más poderoso del proyecto.

4. **SODERCAN y financiación pública.** La presentación en SODERCAN indica acceso potencial a financiación pública (ENISA, Cantabria Emprendedora, etc.) que puede dar runway sin diluir.

5. **La documentación existente acelera el segundo desarrollador.** Los documentos 00–11 reducen el tiempo de onboarding de un segundo desarrollador de semanas a días.

---

## Recomendaciones prioritarias

### Inmediatas (antes de Sprint 2)

1. **Crear Supabase branch para staging.** Sin esto, Sprint 2 es un riesgo innecesario.
2. **Configurar CI/CD básico** (GitHub Actions: build + lint + tests).
3. **Regenerar `supabase.gen.ts`** y eliminar los 67 `as any` del Marketplace.
4. **Verificar `.gitignore`** para `e2e/.auth/*.json`.
5. **Implementar notificación email al proveedor** cuando llegue un pedido (usa Edge Function `trade-email` existente).

### Sprint 2

6. **Cerrar Sprint 4 Motor IA (P2–P5)** — Regression Diff y observabilidad antes de hacer más cambios al motor.
7. **Cerrar la consolidación UX** — prerequisito de cualquier demo con proveedor real.

### Próximos 3 meses

8. **Conseguir 20 clientes de pago** y medir retención, precio promedio, y tiempo de activación.
9. **Iniciar el primer piloto técnico con un distribuidor** con el catálogo cargado y un pedido real.
10. **Preparar la reunión con una asociación gremial** con dossier, casos reales, y propuesta económica.

### 2027

11. **Contratar un segundo desarrollador** con experiencia en React/Supabase antes de que el bus factor se convierta en el bloqueador principal.
12. **Refactorizar `AppDashboardView.tsx`** progresivamente — extraer módulos a archivos propios.
13. **Comenzar la app móvil en serio** — paridad de flujos críticos de campo con la versión web.

---

## Valoración global

**¿Está TrabFlow preparado para iniciar pilotos comerciales con distribuidores y asociaciones antes de abrir Sprint 2?**

**Sí, con condiciones.**

**Condición 1 — Cierre de consolidación UX:** No presentar el Marketplace a un distribuidor real hasta que todas las pantallas que van a ver (portal de pedidos, catálogo) estén en el Product Language correcto y visualmente consistentes.

**Condición 2 — Implementación de notificación email:** El distribuidor necesita saber cuando llega un pedido sin tener que revisar el portal constantemente. Sin esto, el piloto fracasará por falta de respuesta del proveedor, no por fallo del producto.

**Condición 3 — Staging antes de Sprint 2:** El Sprint 2 incluye migraciones de base de datos (Realtime, registro de proveedores). Sin staging, el riesgo de producción es inaceptable con clientes pagadores.

Si estas tres condiciones se cumplen, el producto está en condiciones de soportar un piloto real con un distribuidor y de presentarse a asociaciones gremiales con credibilidad.

**Puntuación global de madurez: 6.0 / 10**

Esta puntuación refleja un producto técnicamente más avanzado de lo que es normal en esta etapa de desarrollo, pero con gaps significativos en validación de mercado, infraestructura, y cobertura móvil que limitan la escalabilidad inmediata. Es una puntuación honesta para un proyecto de esta antigüedad, con este equipo y con estos recursos.

El potencial para llegar a 8/10 en 12 meses existe si se priorizan correctamente los gaps identificados.

---

## Inconsistencias detectadas entre documentos (00–11)

Durante la elaboración de este informe se han detectado las siguientes inconsistencias menores entre documentos existentes:

### Inconsistencia 1

**Documentos:** `00_MASTER_ROADMAP.md` (sección "Objetivos 2026") y `07_GO_TO_MARKET.md` (sección "Los primeros 100 usuarios")

**Problema:** El roadmap indica "20 beta → 100 de pago" como objetivo 2026, mientras que la estrategia GTM sugiere que 100 pagadores en 2026 es el escenario optimista dado el timeline (la cadena asociación → distribuidor → escala lleva a 2027).

**Propuesta:** Ajustar el objetivo 2026 del roadmap a "20 beta activos + inicio de conversión a pago" y mover el objetivo de "100 de pago" a Q1 2027. Esto es coherente con los timelines de captación descritos en el GTM.

### Inconsistencia 2

**Documentos:** `02_IMPLEMENTATION_MASTER_PLAN.md` (Fase 2 — Consolidación UX) y `00_MASTER_ROADMAP.md` (Estado actual — "en consolidación UX")

**Problema:** Ambos documentos son coherentes en el estado, pero el roadmap no especifica el criterio de salida de la fase de consolidación, mientras que el plan de implementación sí lo hace. Hay riesgo de que la consolidación se extienda indefinidamente sin un criterio claro.

**Propuesta:** Añadir en el roadmap una referencia explícita al criterio de salida de la Fase 2: "Demo comercial ejecutable sin inconsistencias visuales, sin lenguaje técnico visible, y sin errores conocidos en las pantallas del Marketplace."

### Inconsistencia 3

**Documentos:** `08_BUSINESS_MODEL.md` (tabla de proyecciones 2027) y `07_GO_TO_MARKET.md` (objetivo 100 usuarios en 2027)

**Problema:** El modelo de negocio asume el escenario base de 500 instaladores pagando en 2027, mientras que el GTM define 100 como objetivo Q1 2027 y 500 como objetivo Q2 2027. Las proyecciones de MRR del modelo de negocio corresponden al escenario base pero el GTM sugiere que ese escenario requiere hasta Q2 2027 en el mejor caso.

**Propuesta:** Esto no es una contradicción sino una diferencia entre escenario de referencia y escenario operativo. Añadir en el modelo de negocio una nota aclarando que el escenario base asume el GTM funcionando en su versión optimista a partir de Q2 2027.

---

*Este informe fue generado como evaluación independiente del estado del proyecto en julio de 2026. Debe revisarse antes de la ronda de inversión seed y al cierre de cada fase de implementación.*
