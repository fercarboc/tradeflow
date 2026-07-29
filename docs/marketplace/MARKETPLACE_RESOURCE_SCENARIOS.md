# TrabFlow Connect — Escenarios de Recursos

> **Versión:** 1.0 — 2026-07-23
> **Propósito:** Comparar tres escenarios de dotación de equipo para desarrollar el marketplace B2B,
> con estimaciones de tiempo, coste y riesgo realistas basadas en el estado real del repositorio.

---

## PUNTO DE PARTIDA (igual en todos los escenarios)

- **Base técnica existente:** Motor IA v59 (98.2%), catálogos de proveedor, panel comparación,
  pedidos de material, RLS, aprendizaje automático — TODO implementado.
- **Deuda técnica conocida:** Sin CI/CD, sin staging separado, Word de pedido duplicado.
- **Sprint 4 activo:** Trabajando en observabilidad del motor IA. No modificar el motor.
- **Infraestructura:** Vercel + Supabase (sin coste fijo hasta escalar).

---

## ESCENARIO A — FUNDADOR SOLO (Bootstrap)

### Perfil
- 1 persona: fundador técnico con experiencia fullstack React + Supabase
- Tiempo disponible: ~25h/semana (el resto: ventas, soporte, onboarding)
- Coste directo adicional: 0€/mes en equipo

### Capacidad real
Sin equipo, el fundador puede avanzar en PARALELO con las ventas pero no en sprint agresivo.
El riesgo principal es el **desequilibrio entre construir y vender**: si se construye sin vender,
el producto no tiene validación real; si se vende sin construir, se crean expectativas que no se cumplen.

### Roadmap realista (Escenario A)

| Mes | Foco | Entregable |
|-----|------|-----------|
| 1 | Infraestructura de calidad | CI/CD básico, staging Supabase, tests E2E verificados |
| 2 | Portal proveedor MVP | Registro proveedor, CRUD catálogo, ver pedidos recibidos |
| 3 | Onboarding 5 proveedores piloto | 5 catálogos reales cargados, 10 instaladores probando |
| 4 | Feedback loop + ajustes | Iteración sobre UX del portal proveedor |
| 5 | Comisiones (Stripe Connect) | Modelo de pago funcional, primer pedido con comisión |
| 6 | Go-to-market limitado | 20 proveedores, 50 instaladores activos, pitch deck actualizado |

**Total Fase 1+2+3:** 6 meses calendar
**Total Fases 4+5:** +6 meses adicionales (12 meses total)

### Estimación económica (Escenario A)

| Partida | Coste mensual | Observación |
|---------|--------------|-------------|
| Vercel Pro | 20€ | Preview deployments para staging |
| Supabase Pro | 25€ | Proyecto staging separado |
| Stripe fees | Variable | 2.9% + 0.30€ por transacción |
| Herramientas dev | 50€ | GitHub Pro, Sentry free |
| **Total fijo** | **~95€/mes** | Sin salario equipo |

### Riesgos del Escenario A

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Fundador quemado por doble rol (build + sell) | Alta | Alto | Definir bloques de tiempo separados. Lunes-miércoles: código. Jueves-viernes: ventas |
| Velocidad insuficiente para capturar mercado | Media | Alto | Priorizar SOLO Fase 1 y 2. Fase 3+ requiere financiación |
| Deuda técnica se acumula | Media | Medio | Dedicar 20% del tiempo a tests y CI desde el primer mes |
| Proveedores no se registran solos | Alta | Alto | Onboarding manual los primeros 20. Auto-registro es un lujo, no una necesidad |

### Veredicto Escenario A

**Viable para validar el concepto.** No viable para escalar. El objetivo es: en 6 meses, tener
5 proveedores reales, 50 instaladores usando el marketplace, y datos para levantar inversión
o contratar el primer desarrollador. El MVP del marketplace B2B es alcanzable en solitario.

---

## ESCENARIO B — FUNDADOR + 1 DESARROLLADOR JUNIOR/MID

### Perfil
- 1 fundador técnico: arquitectura, decisiones de producto, ventas técnicas
- 1 desarrollador Mid (3-4 años exp.): React + Supabase — puede trabajar con supervisión
- Coste: 2.000-2.500€/mes (freelance) o 28.000-35.000€ bruto/año (contrato)

### Capacidad real
Con dos personas, se pueden separar los tracks: uno trabaja en infraestructura/backend y otro
en frontend/portal proveedor. El fundador mantiene el contexto arquitectónico y sigue vendiendo.
**Velocidad: ~2.5x respecto al Escenario A.**

### Roadmap realista (Escenario B)

| Mes | Fundador | Desarrollador | Entregable |
|-----|----------|---------------|-----------|
| 1 | CI/CD + staging + arquitectura portal proveedor | Tests E2E + consolidación Word | Infraestructura lista |
| 2 | Backend portal (auth proveedor, RLS, migraciones) | Frontend portal proveedor | Portal proveedor Alpha |
| 3 | Stripe Connect integración | Vista pedidos proveedor | Pago con comisión funcional |
| 4 | Red de descubrimiento (catálogo público) | UX y refinamiento portal | Beta con 10 proveedores |
| 5 | Valoraciones, notificaciones | Dashboard analítico proveedor | Producto completo v1 |
| 6 | Webhooks ERP básico | Tests de carga, optimización | Go-to-market |

**Total Fases 1+2+3:** 3 meses
**Total Fases 4+5:** +3 meses (6 meses total para producto completo v1)

### Estimación económica (Escenario B)

| Partida | Coste mensual | Anual |
|---------|--------------|-------|
| Vercel Pro | 20€ | 240€ |
| Supabase Pro | 25€ | 300€ |
| 1 Desarrollador Mid (freelance) | 2.000€ | 24.000€ |
| Herramientas dev | 100€ | 1.200€ |
| Sentry, monitoring | 30€ | 360€ |
| **Total** | **~2.175€/mes** | **~26.100€** |

### Modelo financiero de sostenibilidad (Escenario B)

Para cubrir el coste del desarrollador (2.000€/mes):

```
Opción A — Suscripciones:
  70 instaladores × 29€/mes = 2.030€/mes ← punto de equilibrio
  (TrabFlow ya está cerca de este número si tiene usuarios activos)

Opción B — Comisiones marketplace:
  GMV necesario: 2.000 / 0.02 = 100.000€/mes en pedidos
  A 350€/pedido = 286 pedidos/mes = ~6 pedidos/día
  Con 50 instaladores activos: 5.7 pedidos/instalador/mes (muy realista)

Opción C — Mixta: 40 instaladores Pro + comisiones menores
```

### Riesgos del Escenario B

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Desarrollador junior sin contexto del dominio | Media | Medio | 2 semanas de onboarding con docs de arquitectura existentes |
| Velocidad menor de la esperada | Media | Bajo | Sprint planning de 2 semanas con revisión de entregables |
| Coste fijo antes de ingresos suficientes | Media | Alto | Contratación en mes 2-3, cuando el concepto ya tiene tracción |
| Gestión de equipo consume tiempo del fundador | Baja | Medio | Code reviews 1x/semana, daily async por Slack |

### Veredicto Escenario B

**Escenario óptimo para la fase actual.** Permite construir el marketplace completo en 6 meses
mientras el fundador mantiene ventas y product direction. El punto de equilibrio financiero es
alcanzable antes de los 6 meses si el onboarding de proveedores comienza en el mes 2.
**Recomendación: iniciar búsqueda de desarrollador mid freelance al validar Fase 1.**

---

## ESCENARIO C — EQUIPO FINANCIADO (Seed Round 300-500K€)

### Perfil
- 1 fundador (CEO/CPO): product, ventas, relaciones con proveedores
- 1 CTO/Tech Lead (5+ años): arquitectura, contrataciones técnicas
- 2 Desarrolladores Mid-Senior: frontend y backend separados
- 1 Diseñador UX part-time: portal proveedor y app instalador
- 1 Comercial: onboarding de proveedores y instaladores

### Capacidad real
Con este equipo, TrabFlow Connect puede construirse en paralelo con TrabFlow core.
El riesgo principal cambia: ya no es velocidad sino **coordinación y dirección de producto**.
Con 5 personas, la gestión consume 30% de la capacidad del fundador.

### Roadmap realista (Escenario C)

| Mes | Track A (Backend) | Track B (Frontend) | Track C (Ventas) | Milestone |
|-----|------------------|-------------------|-----------------|-----------|
| 1 | Staging + CI/CD + arquitectura marketplace | Portal proveedor wireframes + auth | Pipeline 20 proveedores piloto | Infraestructura |
| 2 | API proveedor + RLS + Stripe Connect | Portal proveedor MVP | Onboarding 5 proveedores | Portal Alpha |
| 3 | Sistema de comisiones + webhooks | Dashboard analítico proveedor | 20 proveedores firmados | Piloto controlado |
| 4 | Valoraciones + red descubrimiento | App instalador (mejoras UX) | Lanzamiento en 2 ciudades | Go-to-market |
| 5 | Webhooks ERP + API pública | Inteligencia de precios (histórico) | Expansión nacional | v1.0 |
| 6 | Optimización, monitorización, SLA | Mobile app (React Native) | 100 proveedores, 500 instaladores | Series A prep |

**Total Fases 1-5:** 6 meses con equipo completo
**Fase 5 (Inteligencia de mercado):** mes 5-6

### Estimación económica (Escenario C)

| Partida | Coste mensual | Anual |
|---------|--------------|-------|
| CTO/Tech Lead | 4.500€ | 54.000€ |
| 2 Desarrolladores Mid | 2.500€ × 2 = 5.000€ | 60.000€ |
| Diseñador UX (0.5 FTE) | 1.500€ | 18.000€ |
| Comercial | 2.000€ + comisión | 24.000€+ |
| Infraestructura (Supabase, Vercel, AWS) | 300€ | 3.600€ |
| Herramientas y licencias | 500€ | 6.000€ |
| Marketing y eventos | 1.000€ | 12.000€ |
| **Total operativo** | **~14.800€/mes** | **~177.600€/año** |

Con seed de 400.000€ y 0€ de ingresos iniciales: **runway de ~27 meses**.
Con modelo mixto (suscripciones + comisiones desde mes 4): runway extendido.

### Proyección de ingresos (Escenario C)

```
Mes 1-3: 0€ marketplace (construcción)
         ~3.000€/mes suscripciones existentes

Mes 4: 20 proveedores × 49€ = 980€
       GMV ~10.000€ × 2% = 200€
       Subtotal: ~1.180€/mes marketplace

Mes 6: 100 proveedores × 49€ = 4.900€
       GMV ~80.000€ × 2% = 1.600€
       Suscripciones 200 instaladores × 29€ = 5.800€
       Total: ~12.300€/mes

Mes 12: 300 proveedores × 49€ = 14.700€
        GMV ~500.000€ × 2% = 10.000€
        Suscripciones 500 instaladores × 35€ (ARPU) = 17.500€
        Total: ~42.200€/mes → ~506.400€ ARR
```

### Hitos para Series A (con Escenario C)

- [ ] GMV > 200.000€/mes durante 3 meses consecutivos
- [ ] NPS proveedores > 45
- [ ] Churn mensual instaladores < 3%
- [ ] Cobertura de catálogo > 70% de familias más solicitadas
- [ ] Operativo en al menos 3 comunidades autónomas

### Riesgos del Escenario C

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Salida del motor IA a producción con regression | Media | Alto | NUNCA saltarse el benchmark de 400 casos |
| Proveedores no adoptan el portal | Media | Alto | Primeros 20 onboarding manual con el comercial |
| Gestión de equipo resta foco al producto | Alta | Medio | CTO gestiona el día a día técnico; fundador mantiene roadmap |
| Competencia (Mercadona Tech, BRICCO B2B, etc.) | Baja | Alto | Diferencial: integración con motor IA propio |
| Stripe Connect: compliance KYC proveedor | Media | Alto | Iniciar proceso de verificación Stripe en mes 1 |

### Veredicto Escenario C

**Escenario agresivo, viable con financiación adecuada.** Permite capturar mercado antes de
que los competidores tradicionales (ERPs de distribución) lancen alternativas SaaS. El riesgo
no es técnico sino comercial: el value proposition del marketplace B2B debe ser lo suficientemente
claro para que los proveedores cedan control de su catálogo a una plataforma nueva.

---

## COMPARATIVA FINAL

| Dimensión | A (Solo) | B (Solo+1) | C (Equipo financiado) |
|-----------|---------|-----------|----------------------|
| Tiempo hasta Portal Proveedor MVP | 2 meses | 2 meses | 2 meses |
| Tiempo hasta Go-to-market | 6 meses | 6 meses | 4 meses |
| Tiempo hasta Fase 5 completa | 18+ meses | 12 meses | 6 meses |
| Coste mensual equipo | 0€ | ~2.000€ | ~14.000€ |
| Riesgo de burnout fundador | Alto | Medio | Bajo |
| Riesgo de falta de foco | Bajo | Bajo | Alto |
| Velocidad relativa | 1x | 2.5x | 5x |
| Financiación necesaria | Bootstrap | ~50K€/año | 300-500K€ |
| Recomendado si... | Validando concepto | Primer cliente pagando | Tracción demostrada |

---

## RECOMENDACIÓN

**Hoy (2026-07-23): Escenario A con preparación para B.**

1. Durante los próximos 60 días: construir Fase 1 (CI/CD + staging + Portal Proveedor Alpha) en solitario.
2. Onboardear manualmente los primeros 3-5 proveedores piloto. Entrevistas de producto. Iterar.
3. Si los proveedores piloto muestran engagement real (3+ pedidos en el primer mes): buscar
   desarrollador mid freelance → pasar a Escenario B.
4. Si la tracción supera las expectativas (20+ proveedores, GMV > 50K€/mes): preparar pitch
   para seed round → Escenario C.

**La tecnología no es el cuello de botella. La adopción de los proveedores lo es.**

---

*Escenarios de recursos: 2026-07-23 — TrabFlow Connect*
