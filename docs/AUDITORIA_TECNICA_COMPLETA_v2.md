# AUDITORÍA TÉCNICA COMPLETA — TRABFLOW v2
## Director de Ingeniería · Junio 2026

---

## SISTEMA DE CLASIFICACIÓN COMPLETO

| Clase | Significado |
|-------|-------------|
| **A** | Correcto — no tocar |
| **B** | Corregir antes de Beta (septiembre 2026) |
| **C** | Después del Product-Market Fit |
| **D** | No tocar nunca mientras se valida mercado |
| **E** | No aporta valor al cliente — no se hace jamás |

---

### CLASE E — REGLA ABSOLUTA

**Definición:** Cualquier cambio que no produce ningún beneficio visible para el instalador que usa la app.

**Ejemplos de Clase E:**
- Renombrar `components/` a `features/`
- Cambiar `supabase.ts` a `supabase/index.ts`
- Reorganizar carpetas sin cambiar funcionalidad
- Convertir `enum ActivePage` en `type ActivePage`
- Añadir abstracciones que solo "quedan más limpias"
- Refactorizar un componente que funciona solo por estética
- Unificar dos archivos que ya funcionan por separado
- Añadir capas de indirección que no resuelven bugs reales

**Regla:** Si un instalador en Bilbao no puede notar la diferencia, es Clase E. No se hace.

---

---

# PARTE I — AUDITORÍA TÉCNICA

## RESUMEN EJECUTIVO

TradeFlow es una aplicación React 19 + Supabase con ~50.000 líneas de código, 21 edge functions Deno, y un modelo de datos bien estructurado. Para el objetivo de beta septiembre 2026, el estado técnico es viable. Hay 9 problemas Clase B que deben corregirse antes de la beta y ninguno bloquea el calendario comercial.

---

## 1. ARQUITECTURA GENERAL — `A` / `B1`

### Lo que está correcto (A)

- Stack React 19 + Vite 6 + Supabase + Deno Edge Functions: moderno, sin deuda tecnológica inmediata.
- SPA con `vercel.json` configurado correctamente (rewrites a `/index.html`).
- PWA con Service Worker y manifest correcto.
- Separación limpia entre app autenticada y páginas públicas.

### B1 — Doble suscripción a `onAuthStateChange`

**Problema:** `App.tsx` (línea 166) y `SessionContext.tsx` (línea 186) suscriben de forma independiente al evento de autenticación. Dos listeners coexisten con orden de ejecución no determinista.

**Impacto:** Estado de `org`, `plan` y `permisos` puede ser inconsistente momentáneamente. Flash de "usuario sin organización" al hacer logout desde móvil.

**Riesgo:** Medio.

**Tiempo:** 2-3 horas.

**Propuesta:** Eliminar la suscripción en `App.tsx`. `SessionContext` pasa a ser la única fuente de verdad de auth. `App.tsx` consume `useSession()`.

---

## 2. ORGANIZACIÓN DE CARPETAS — `C`

La estructura actual funciona para el equipo actual (una persona). La reorganización en feature-folders post-PMF. No tocar durante la validación.

**Clasificación:** `C`

---

## 3. COMPONENTES — `B2` / `B9` / `C`

### B2 — Sin code splitting: bundle inicial ~3MB

**Problema:** `AppDashboardView.tsx` (9988 líneas, 531KB), `AdminView.tsx` (3546 líneas), y los demás componentes pesados se cargan completamente en el bundle inicial. En conexiones lentas de obra (3G), Time To Interactive de 8-15 segundos.

**Riesgo:** Alto para la primera impresión en beta.

**Tiempo:** 4-6 horas.

**Propuesta:** Añadir `React.lazy()` en `App.tsx` para `AppDashboardView`, `AdminView`, `ScreenWorkerView`. Envolver en `<Suspense>`. Reduce el bundle inicial un 60% sin tocar ningún componente.

### B9 — Sin Error Boundaries

**Problema:** Ningún `<ErrorBoundary>` en el árbol. Un error no capturado = pantalla en blanco para el beta tester.

**Riesgo:** Alto para percepción de calidad.

**Tiempo:** 2 horas.

**Propuesta:** Un ErrorBoundary de clase en `App.tsx` que muestre un mensaje amigable con botón de recarga.

---

## 4. HOOKS — `C`

Solo existe `usePermissions.ts` (10 líneas). Extraer hooks por dominio es trabajo post-PMF.

---

## 5. CONTEXT — `B1` (ya cubierto)

`SessionContext.tsx` está bien diseñado. El único problema es la doble suscripción (B1).

---

## 6. SERVICIOS — `B3` / `C`

### B3 — Castings `as unknown as` en supabase.ts

**Problema:** 150+ funciones de acceso a datos en un archivo de 4602 líneas. Los tipos de retorno se convierten con `as unknown as TipoEsperado[]`. Si el schema cambia, TypeScript no detecta la incompatibilidad.

**Tiempo:** 2 horas para el primer pase (generar tipos con `supabase gen types`).

### C — División de supabase.ts

**Clasificación:** `C` — Post-PMF.

---

## 7. ROUTING — `C`

Routing manual con `useState<ActivePage>`. Sin soporte para back/forward del navegador ni deep linking. Migración a React Router v7 post-PMF.

---

## 8. SUPABASE — `A` / `B4`

### Lo que está correcto (A)

- RLS habilitado en tablas críticas.
- `maybeSingle()` en lugar de `single()` donde puede haber 0 resultados.
- `SECURITY DEFINER` en funciones que necesitan escalar privilegios.
- `trade_org_permissions` para overrides granulares por miembro.

### B4 — `search_path` mutable en 13 funciones SQL

**Problema:** La migración `20260624_security_hardening.sql` identifica las funciones pero solo genera el SQL correctivo como un `SELECT` — no lo aplica.

**Riesgo:** Medio. Crítico antes de registro público abierto.

**Tiempo:** 30 minutos.

**Propuesta:** Ejecutar el SELECT de la migración, copiar el resultado, ejecutar los ALTER FUNCTION.

---

## 9. SEGURIDAD — `A` / `B5` / `B6`

### Lo que está correcto (A)

- Stripe webhook: HMAC-SHA256 con replay protection de ±5 minutos.
- `SUPABASE_SERVICE_ROLE_KEY` solo server-side.
- Variables `VITE_*` solo para lo que necesita el cliente.
- Storage de fotos de obra restringido a `authenticated`.

### B5 — CORS wildcard en edge functions

**Problema:** Todas las edge functions usan `'Access-Control-Allow-Origin': '*'`. Las funciones de IA (`trade-voice-to-quote`, `trade-photo-scan`) pueden ser llamadas desde cualquier dominio.

**Riesgo:** Económico. Los datos están protegidos por auth, pero el consumo de AI puede explotarse.

**Tiempo:** 2 horas.

**Propuesta:** Restringir a `['https://trabflow.com', 'https://www.trabflow.com']`.

### B6 — `ADMIN_EMAIL` visible en el bundle público

**Problema:** El email de administrador queda compilado en el JavaScript público.

**Riesgo:** Bajo durante beta cerrada. Moderado en lanzamiento público.

**Tiempo:** 1 hora.

---

## 10. PERFORMANCE — `B2` / `C`

B2 (code splitting) cubre el problema principal. Las dependencias pesadas (`tesseract.js`, `pdf2pic`, `canvas`) deben verificarse: si solo se usan en edge functions, sobran del bundle del cliente.

---

## 11. ESCALABILIDAD — `D`

Supabase RLS + Edge Functions escala a miles de usuarios sin cambios. No hay nada que hacer aquí durante la validación.

**Clasificación:** `D`

---

## 12. CÓDIGO DUPLICADO — `C`

Tipos duplicados entre `types.ts` y `supabase.ts`. Corrección post-PMF.

---

## 13. DEPENDENCIAS — `B7` / `C`

### B7 — `express` y `dotenv` en dependencies

**Problema:** Están en `dependencies` en lugar de `devDependencies`.

**Tiempo:** 15 minutos.

---

## 14. TIPADO — `B8`

### B8 — TypeScript strict mode desactivado

**Problema:** Sin `"strict": true`. Sin `strictNullChecks`. TypeScript no detecta accesos a campos opcionales antes del runtime.

**Tiempo:** 4-8 horas para activar `strictNullChecks` y corregir errores.

**Propuesta:** Activar en la siguiente semana tranquila.

---

## 15. TESTING — `C`

Cero tests. Aceptable para beta cerrada con 20 instaladores de confianza y QA manual.

**Flujos críticos que requieren QA manual antes de cada deploy:**
1. Login / logout / recuperación de contraseña
2. Crear presupuesto → enviar → cliente acepta (`/p/token`)
3. Crear factura desde presupuesto
4. Stripe checkout → upgrade → verificar acceso a features del nuevo plan
5. Invitar técnico → inicia sesión → ve solo sus trabajos

---

## 16. LOGGING — `B` / `C`

**B:** Añadir `requestId` en edge functions (30 min). Correlación de logs en producción.

**C:** Sentry y logging estructurado en cliente post-PMF.

---

## 17. GESTIÓN DE ERRORES — `B9` (ya cubierto)

---

## 18. RAG — `A` / `B4` (ya cubierto)

Arquitectura híbrida correcta. Funciones SQL con `search_path` mutable pendiente de aplicar.

---

## 19. BASE MAESTRA — `A`

Diseño correcto. `search_path` es el único issue (B4).

---

## 20. EDGE FUNCTIONS — `A` / `B5` (ya cubierto)

21 funciones Deno. Stripe webhook implementado correctamente. CORS wildcard pendiente (B5).

---

## CONSOLIDADO CLASE B

| ID | Problema | Tiempo | Urgencia |
|----|----------|--------|----------|
| B1 | Doble suscripción onAuthStateChange | 3h | Alta |
| B2 | Sin code splitting: bundle ~3MB | 6h | Alta |
| B9 | Sin Error Boundary | 2h | Alta |
| B4 | search_path mutable sin aplicar en 13 funciones SQL | 30min | Media |
| B5 | CORS wildcard en edge functions | 2h | Media |
| B8 | TypeScript strict mode desactivado | 6h | Media |
| B3 | Tipos generados Supabase para 5 modelos clave | 2h | Media |
| B6 | ADMIN_EMAIL visible en bundle | 1h | Baja |
| B7 | express/dotenv en dependencies | 15min | Baja |

**Total Clase B: ~23 horas distribuidas en julio-agosto.**

---

---

# PARTE II — AUDITORÍA DE PRODUCTO

*Lo que ve el cliente. Lo que siente el inversor.*

---

## METODOLOGÍA

Cada módulo se puntúa en tres dimensiones:

- **Valor percibido** — ¿El instalador lo entiende y lo usa sin formación?
- **Completitud** — ¿Está terminado o hay huecos evidentes?
- **Diferenciación** — ¿Esto lo tiene la competencia?

Escala: 1-10. Por debajo de 7 en valor percibido = riesgo para la beta.

---

## MÓDULOS PRINCIPALES

### Presupuesto por Voz
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 9/10 |
| Completitud | 8/10 |
| Diferenciación | 10/10 |

**Comentario:** El diferenciador principal de TrabFlow. Un instalador habla y tiene un presupuesto en 30 segundos. Nada en el mercado español lo hace igual. Completitud a 8 porque ocasionalmente la IA necesita corrección manual.

**Acción antes de beta:** Mejorar el prompt para que el presupuesto salga con menos errores en precios de materiales. Prioridad alta.

---

### Presupuesto por Foto
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 8/10 |
| Completitud | 7/10 |
| Diferenciación | 9/10 |

**Comentario:** Muy potente para el instalador que llega a una obra y no sabe por dónde empezar. La foto del trabajo anterior genera una estimación. Completitud a 7 porque el reconocimiento de imágenes complejas aún falla en instalaciones eléctricas y HVAC.

---

### Dashboard Principal
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 8/10 |
| Completitud | 8/10 |
| Diferenciación | 6/10 |

**Comentario:** Claro, funcional, muestra lo que importa. La diferenciación es menor porque otros SaaS de gestión tienen dashboards similares. El diferenciador está en los módulos de IA, no en el dashboard.

**Acción:** Añadir en el dashboard un KPI de "ahorro estimado con IA" para que el instalador vea el valor que genera TrabFlow. Esto sube la diferenciación a 8.

---

### Facturación
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 8/10 |
| Completitud | 8/10 |
| Diferenciación | 5/10 |

**Comentario:** Funcional y completo. La diferenciación es baja porque todos los competidores tienen facturación. El valor está en la integración directa con el presupuesto por voz.

---

### Gestión de Clientes
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 7/10 |
| Completitud | 7/10 |
| Diferenciación | 5/10 |

**Comentario:** Cumple su función. No es diferenciador pero es necesario para el flujo completo.

---

### Planificación de Trabajos
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 7/10 |
| Completitud | 7/10 |
| Diferenciación | 7/10 |

**Comentario:** Útil para empresas con más de 2 técnicos. Para instaladores solos, es menos relevante.

---

### Gestión de Equipo (Multiusuario)
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 8/10 |
| Completitud | 8/10 |
| Diferenciación | 7/10 |

**Comentario:** Muy valorado por empresas con técnicos de campo. El técnico ve solo sus trabajos, el jefe ve todo. Simple y efectivo.

---

### Parte de Trabajo (Técnico Móvil)
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 8/10 |
| Completitud | 7/10 |
| Diferenciación | 7/10 |

**Comentario:** El técnico en campo puede registrar lo que hizo desde el móvil. Muy práctico. Completitud a 7 por la paridad pendiente móvil vs PC.

---

### Contratos de Mantenimiento
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 8/10 |
| Completitud | 8/10 |
| Diferenciación | 8/10 |

**Comentario:** Módulo infravalorado. Una empresa de mantenimiento puede facturar automáticamente sus contratos mensuales. Pocas soluciones del sector lo hacen bien.

---

### Asistente Técnico (RAG Normativa)
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 7/10 |
| Completitud | 7/10 |
| Diferenciación | 9/10 |

**Comentario:** El instalador puede preguntar "¿cuántos circuitos necesito para un local de 200m²?" y obtener la respuesta con la normativa REBT. Muy diferenciador. Valor percibido a 7 porque muchos instaladores no saben que esta función existe — es un problema de onboarding y comunicación, no de producto.

---

### Catálogos de Proveedores
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 7/10 |
| Completitud | 7/10 |
| Diferenciación | 8/10 |

**Comentario:** El presupuesto incluye precios reales de Obramat, Saltoki, Sonepar. Muy diferenciador para los distribuidores.

---

### Rutas del Día
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 6/10 |
| Completitud | 6/10 |
| Diferenciación | 6/10 |

**Comentario:** Útil pero no urgente. Los instaladores con pocas visitas no lo necesitan. Los que tienen muchas, ya usan Google Maps.

---

### Onboarding
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 5/10 |
| Completitud | 6/10 |
| Diferenciación | — |

**ALERTA ROJA:** El onboarding es el punto más débil del producto. Un instalador que llega sin formación previa puede perderse antes de crear su primer presupuesto. Esto es el mayor riesgo para la beta.

**Acción urgente antes de beta:**
1. El primer paso del onboarding debe crear un presupuesto de prueba en menos de 2 minutos.
2. Añadir un vídeo tutorial de 90 segundos en la pantalla de bienvenida.
3. El primer presupuesto debe ser guiado paso a paso (tooltip overlay).

---

### Landing Page
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 8/10 |
| Completitud | 8/10 |
| Diferenciación | 8/10 |

**Comentario:** Clara, profesional, con demo interactiva. El mensaje "presupuesto en 30 segundos" es poderoso.

---

### Demo Interactiva (Partner Demo)
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 8/10 |
| Completitud | 8/10 |
| Diferenciación | 9/10 |

**Comentario:** Pocos SaaS B2B tienen una demo interactiva sin login. Muy útil para reuniones con CONAIF, FENIE, distribuidores.

---

### Chatbot de Ayuda
| Dimensión | Puntuación |
|-----------|-----------|
| Valor percibido | 6/10 |
| Completitud | 7/10 |
| Diferenciación | 6/10 |

**Comentario:** Funcional pero los beta testers probablemente llamarán al fundador antes que usar el chatbot. Suficiente para la beta.

---

## RESUMEN AUDITORÍA DE PRODUCTO

```
SEMÁFORO DE MÓDULOS — BETA SEPTIEMBRE 2026

VERDE (listo para beta)
✅ Presupuesto por Voz         9/10
✅ Presupuesto por Foto        8/10
✅ Dashboard Principal         8/10
✅ Facturación                 8/10
✅ Gestión de Equipo           8/10
✅ Parte de Trabajo            8/10
✅ Contratos de Mantenimiento  8/10
✅ Landing Page                8/10
✅ Demo Interactiva            8/10

AMARILLO (aceptable, mejorar antes de reuniones con asociaciones)
🟡 Gestión de Clientes         7/10
🟡 Planificación               7/10
🟡 Asistente Técnico           7/10
🟡 Catálogos Proveedores       7/10
🟡 Chatbot de Ayuda            6/10
🟡 Rutas del Día               6/10

ROJO (requiere acción antes de beta)
🔴 Onboarding                  5/10  ← PRIORIDAD #1
```

---

---

# PARTE III — AUDITORÍA UX

*Lo que siente el instalador. Lo que ve el inversor.*

---

## METODOLOGÍA

Recorrido de un usuario nuevo desde cero. Cada paso se puntúa en:
- **Claridad** — ¿Se entiende sin explicación?
- **Fricción** — ¿Cuántos clics / decisiones innecesarios?
- **Emoción** — ¿Produce satisfacción o frustración?

---

## FLUJO 1: PRIMER CONTACTO (Landing → Registro)

### Landing Page
- **Claridad:** 8/10 — El headline "Presupuestos en 30 segundos" es claro.
- **Fricción:** Baja — CTA visible, demo accesible sin login.
- **Emoción:** 8/10 — La demo interactiva genera "eso me gustaría tener".

**Observación:** El instalador medio tiene 45 años y llega desde Google. El copy debe hablar de "electricistas", "fontaneros", "presupuestos" — no de "IA" ni "automatización". Verificar que el SEO y el copy landing estén alineados con cómo busca el instalador real.

### Registro (Onboarding Wizard)
- **Claridad:** 6/10 — Los 7 pasos del wizard son muchos para el primer día.
- **Fricción:** Alta — Pide demasiada información antes de dejar al usuario tocar el producto.
- **Emoción:** 5/10 — El instalador quiere crear un presupuesto, no rellenar formularios.

**Propuesta UX:** Reducir el registro a 3 campos (nombre, email, oficio). Todo lo demás se pide después del primer presupuesto. El instalador debe llegar al dashboard en menos de 60 segundos desde que introduce su email.

---

## FLUJO 2: CREAR UN PRESUPUESTO POR VOZ

- **Claridad:** 9/10 — El botón de micrófono es prominente.
- **Fricción:** Baja — Hablas, esperas 10-15 segundos, tienes el presupuesto.
- **Emoción:** 9/10 — "Esto es magia" es la reacción esperada.

**Observación positiva:** Este flujo es el más fuerte del producto. Es el "momento wow" que hay que usar en el vídeo de pitch y en la demo de las reuniones con CONAIF.

**Mejora menor:** Añadir una animación visible mientras el presupuesto se genera (el instalador necesita saber que algo está pasando, no que la app se colgó).

---

## FLUJO 3: ENVIAR PRESUPUESTO POR WHATSAPP

- **Claridad:** 8/10 — Botón de WhatsApp visible.
- **Fricción:** Baja — Un clic abre WhatsApp con el mensaje y el link del presupuesto.
- **Emoción:** 9/10 — El cliente recibe un link profesional. El instalador parece una empresa.

**Observación positiva:** Este es el segundo "momento wow". Un fontanero independiente enviando un presupuesto con link profesional es transformador para su imagen.

---

## FLUJO 4: CLIENTE ACEPTA EL PRESUPUESTO (Vista Pública)

- **Claridad:** 9/10 — La vista pública es limpia y profesional.
- **Fricción:** Muy baja — El cliente hace clic en "Aceptar" y el instalador recibe notificación.
- **Emoción:** 9/10 — El cliente percibe una empresa seria.

**Observación positiva:** Este flujo es impecable. No tocar.

---

## FLUJO 5: CREAR FACTURA DESDE PRESUPUESTO

- **Claridad:** 8/10 — El botón "Crear Factura" desde el presupuesto aceptado es claro.
- **Fricción:** Baja — La factura se genera automáticamente con los datos del presupuesto.
- **Emoción:** 8/10 — Ahorro de tiempo evidente.

---

## FLUJO 6: TÉCNICO DE CAMPO (Vista Móvil)

- **Claridad:** 7/10 — El técnico ve sus trabajos del día.
- **Fricción:** Media — Algunos formularios de parte de trabajo tienen demasiados campos.
- **Emoción:** 7/10 — Funcional pero no deslumbrante.

**Mejora antes de beta:** Reducir el formulario de parte de trabajo a 3 campos obligatorios (qué hice, materiales, tiempo). El resto opcional.

---

## PROBLEMAS UX PRIORITARIOS ANTES DE BETA

```
PRIORIDAD 1 — Onboarding
Reducir registro a 3 campos mínimos.
El instalador debe estar en el dashboard en < 60 segundos.

PRIORIDAD 2 — Animación de carga en presupuesto por voz
El instalador necesita feedback visual mientras la IA trabaja.
Spinner o barra de progreso con texto ("Generando tu presupuesto...").

PRIORIDAD 3 — Parte de trabajo móvil
Reducir campos obligatorios a 3.
Guardar borrador automáticamente.

PRIORIDAD 4 — Tooltip de primeros pasos
Overlay de 3 pasos en el primer acceso al dashboard.
"1. Crea tu primer presupuesto → 2. Envíalo → 3. Factura"
```

---

---

# PARTE IV — AUDITORÍA DE PERFORMANCE PERCIBIDA

*Lo que mide el instalador, no el desarrollador.*

---

## METODOLOGÍA

Performance percibida = lo que el usuario siente, no los Core Web Vitals. Un spinner que gira es mejor que una pantalla en blanco aunque el tiempo real sea el mismo.

Escala: ⭐⭐⭐⭐⭐ = excelente / ⭐ = inaceptable

---

## MÉTRICAS POR ACCIÓN

| Acción | Tiempo estimado | Percepción | Puntuación |
|--------|----------------|------------|------------|
| Abrir la app (primera vez) | 4-8 segundos | Demasiado lenta | ⭐⭐ |
| Abrir la app (PWA instalada) | 1-2 segundos | Aceptable | ⭐⭐⭐⭐ |
| Cargar el dashboard | 1-2 segundos | Buena | ⭐⭐⭐⭐ |
| Crear presupuesto por voz | 15-20 segundos | Lenta pero aceptable (IA) | ⭐⭐⭐ |
| Crear presupuesto por foto | 20-30 segundos | Lenta (IA) | ⭐⭐⭐ |
| Abrir lista de clientes | 200-500ms | Excelente | ⭐⭐⭐⭐⭐ |
| Abrir un presupuesto | 200-500ms | Excelente | ⭐⭐⭐⭐⭐ |
| Crear factura | 500ms-1s | Buena | ⭐⭐⭐⭐ |
| Enviar presupuesto (WhatsApp) | 1 segundo | Buena | ⭐⭐⭐⭐ |
| Cliente abre link del presupuesto | 1-2 segundos | Buena | ⭐⭐⭐⭐ |
| Cargar vista de técnico móvil | 1-2 segundos | Buena | ⭐⭐⭐⭐ |
| Consulta al asistente técnico | 5-8 segundos | Lenta pero aceptable | ⭐⭐⭐ |

---

## PROBLEMAS DE PERFORMANCE PERCIBIDA

### PP1 — Primera carga de la app (⭐⭐)

**Problema real:** Bundle sin code splitting (~3MB). En 4G normal son 3-5 segundos de pantalla en negro antes de que aparezca algo.

**Solución:** B2 (code splitting con React.lazy). Reduce la primera carga a ~1-2 segundos.

**Impacto:** La primera impresión de un inversor o un beta tester. Crítico.

### PP2 — Feedback visual durante generación de presupuesto por IA (⭐⭐⭐)

**Problema:** El instalador habla, hace clic, y espera 15-20 segundos sin saber si la app está procesando o colgada.

**Solución UX:** Animación con texto progresivo:
- "Analizando tu descripción..." (0-3s)
- "Identificando materiales..." (3-8s)
- "Calculando precios..." (8-15s)
- "¡Presupuesto listo!" (>15s)

**Tiempo de implementación:** 1-2 horas.

### PP3 — Carga inicial del asistente técnico (⭐⭐⭐)

**Problema:** La primera consulta RAG tarda 5-8 segundos porque la edge function Deno arranca en frío.

**Causa técnica:** Cold start de Supabase Edge Functions en Deno.

**Solución:** Hacer un "ping" silencioso a la función cuando el usuario abre el asistente (1 petición vacía que calienta la función). Las consultas posteriores serán más rápidas.

**Tiempo:** 30 minutos.

---

## RESUMEN PERFORMANCE

```
CRÍTICO (arreglar antes de beta)
🔴 Primera carga app: 4-8 segundos → SOLUCIÓN: B2 code splitting

MEJORABLE (antes de beta si hay tiempo)
🟡 Feedback visual en IA: pantalla estática → SOLUCIÓN: animación progresiva
🟡 Cold start asistente técnico → SOLUCIÓN: ping silencioso

CORRECTO (no tocar)
🟢 Navegación entre secciones: < 500ms
🟢 Lista de clientes/presupuestos: < 500ms
🟢 PWA instalada: arranque < 2 segundos
🟢 Vista pública del presupuesto: 1-2 segundos
```

---

---

# PARTE V — ROADMAP ACTUALIZADO

## JULIO 2026 — Empresa + Estabilidad

```
SEMANA 1-2 — Fundamentos técnicos críticos
├── B9: Error Boundary
├── B1: Unificar suscripción auth
├── B4: Aplicar search_path fix en SQL
└── PP1+B2: Code splitting (primera carga < 2 segundos)

SEMANA 2-3 — Producto
├── Onboarding: reducir registro a 3 campos
├── Animación de carga en presupuesto por voz
├── Tooltip de primeros pasos en dashboard
└── Ping silencioso en asistente técnico

SEMANA 3-4 — Empresa
├── Grabar vídeo demo de 90 segundos (el "momento wow" por voz)
├── Preparar pitch deck para inversores (12 slides)
├── Actualizar landing con el vídeo demo
└── Definir los 20 instaladores de la beta cerrada
```

## AGOSTO 2026 — Preparación Comercial

```
SEMANA 1-2 — Técnico
├── B5: CORS restringido en edge functions
├── B8: TypeScript strictNullChecks
├── B3: Generar tipos Supabase para 5 modelos clave
└── QA manual de los 5 flujos críticos

SEMANA 2-3 — Comercial
├── Preparar dossier para CONAIF / FENIE / APIEM
├── Preparar dossier para Obramat / Saltoki / Sonepar
├── Recopilar primeros casos de éxito de beta testers (si ya están)
└── Crear FAQs para distribuidores

SEMANA 3-4 — Inversión
├── B6: ADMIN_EMAIL, B7: dependencies (limpieza rápida)
├── Preparar one-pager para Business Angels
├── Preparar borrador solicitud ENISA
└── Vídeo demo profesional (versión larga, 3-4 minutos)
```

## SEPTIEMBRE 2026 — 20 Instaladores. 20 Entrevistas. 20 Aprendizajes.

```
SEMANA 1 — Lanzamiento beta cerrada
├── Alta de los 20 instaladores seleccionados
├── Onboarding personalizado (llamada de 30 min con cada uno)
└── Setup de canal de comunicación (WhatsApp grupo beta)

SEMANA 2-4 — Iteración rápida
├── Entrevista estructurada con cada beta tester (30 min)
├── Recopilar: ¿qué funciona? ¿qué falta? ¿cuánto pagarías?
├── Corregir bugs reportados en < 24 horas
└── Documentar 20 learnings concretos

FIN DE SEPTIEMBRE — Decisiones
├── ¿Qué módulo mejorar para octubre (reuniones)?
├── ¿Qué precio soporta el mercado?
└── ¿Hay 3 casos de éxito documentables?
```

---

---

# PARTE VI — DASHBOARD CEO

*Solo una página. Solo lo que importa. Revisión cada lunes.*

---

```
╔══════════════════════════════════════════════════════════╗
║         TRABFLOW — DASHBOARD CEO — SEMANA 26            ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  PRODUCTO                                                ║
║  ├─ Beta lista           ████████░░  80%                 ║
║  ├─ Onboarding           ████░░░░░░  40%  ← ALERTA       ║
║  └─ Módulos core         █████████░  90%                 ║
║                                                          ║
║  COMERCIAL                                               ║
║  ├─ Demo interactiva     ████████░░  80%                 ║
║  ├─ Landing definitiva   █████████░  90%                 ║
║  ├─ Pitch deck           ███░░░░░░░  30%                 ║
║  └─ Vídeo demo           ░░░░░░░░░░   0%  ← ACCIÓN       ║
║                                                          ║
║  BETA                                                    ║
║  ├─ Instaladores selec.  ░░░░░░░░░░   0/20               ║
║  ├─ Entrevistas hechas   ░░░░░░░░░░   0/20               ║
║  └─ Learnings doc.       ░░░░░░░░░░   0/20               ║
║                                                          ║
║  NORMATIVA               ████████░░  80%                 ║
║  BASE MAESTRA            █████████░  90%                 ║
║                                                          ║
║  ASOCIACIONES                                            ║
║  ├─ CONAIF               ░░░░░░░░░░   0%                 ║
║  ├─ FENIE                ░░░░░░░░░░   0%                 ║
║  └─ APIEM                ░░░░░░░░░░   0%                 ║
║                                                          ║
║  DISTRIBUIDORES                                          ║
║  ├─ Obramat              ░░░░░░░░░░   0%                 ║
║  ├─ Saltoki              ░░░░░░░░░░   0%                 ║
║  └─ Sonepar              ░░░░░░░░░░   0%                 ║
║                                                          ║
║  INVERSIÓN                                               ║
║  ├─ Business Angels      ░░░░░░░░░░   0%                 ║
║  ├─ ENISA                ░░░░░░░░░░   0%                 ║
║  └─ Ronda Seed           ░░░░░░░░░░   0%                 ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║  MRR actual:    0€          Objetivo sep: 500€           ║
║  Beta testers:  0           Objetivo sep: 20             ║
║  Bugs críticos: 2           Objetivo sep: 0              ║
╚══════════════════════════════════════════════════════════╝
```

---

## PROTOCOLO DEL LUNES

**Duración:** 30 minutos máximo.

1. **Revisar el dashboard CEO** (5 min) — ¿Qué avanzó? ¿Qué está en rojo?
2. **Los 3 trabajos de la semana** (10 min) — Solo 3. No 10. Elegir los que más acercan al cliente o al inversor.
3. **Un aprendizaje de la semana anterior** (5 min) — ¿Qué funcionó? ¿Qué no?
4. **Proteger el calendario** (10 min) — ¿Hay algo que pueda retrasar una reunión clave? Mitigarlo.

**Regla:** Si el trabajo de la semana no puede explicarse en una frase ("esta semana termino el code splitting para que la app cargue en 2 segundos"), es demasiado vago.

---

---

# MIGRACIÓN POST PRODUCT-MARKET FIT

*Guardar para cuando haya 100 clientes, 25K MRR, primera ronda cerrada.*

| Módulo | Descripción | Tiempo |
|--------|-------------|--------|
| M1 | React Router v7 (deep linking, browser history) | 1 semana |
| M2 | División de AppDashboardView.tsx | 2-3 semanas |
| M3 | División de supabase.ts en servicios por dominio | 1 semana |
| M4 | Testing de integración (Vitest + Supabase local) | 2 semanas |
| M5 | Sentry + observabilidad | 1 semana |
| M6 | Feature Folders | 1 semana |
| M7 | CI/CD completo (GitHub Actions) | 3-4 días |
| M8 | Tipos generados Supabase (eliminar castings) | 1 semana |
| M9 | Internacionalización (Portugal, LATAM) | 3-4 semanas |

**Total Sprint Arquitectura:** 4-6 semanas de un equipo de 2-3 personas.

---

*Auditoría realizada: 25 de junio de 2026*
*Próxima revisión: octubre 2026 — tras las reuniones con CONAIF/FENIE/APIEM*
*Autor: Director de Ingeniería — TrabFlow*
