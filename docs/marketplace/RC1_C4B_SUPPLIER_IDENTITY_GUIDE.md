# RC1-C.4B — Guía de identidad de proveedores demo

**Versión:** 1.0  
**Fecha:** 2026-08-08  
**Estado:** STOP PARCIAL — guía de referencia para diseño y datos demo  
**Propósito:** Definir la identidad completa de cada proveedor demo para que el ecosistema sea presentable a proveedores reales

---

## Principio rector

Cada proveedor demo tiene una identidad coherente y diferenciada. La plataforma se usa para demostrar el modelo de negocio completo a proveedores reales, por lo que el demo debe ser **creíble, profesional y neutral** — sin referencias a marcas comerciales reales.

---

## 1. Obras y Materiales S.L.

| Campo | Valor |
|-------|-------|
| **Nombre legal** | Obras y Materiales S.L. |
| **Slug** | `obramat-demo` *(conservar)* |
| **Actor ID** | `85e73234-c74e-44e7-865a-1aca8312f9a5` |
| **Catálogo** | `280c05e5` (178 referencias legacy) |
| **Estado** | ✅ Activo — 36 offerings matched |
| **Especialidad** | Materiales de construcción y reforma integral |
| **Posicionamiento demo** | Distribuidor generalista de materiales. Amplio stock, precios competitivos, entrega en obra. |
| **Tagline** | *"Todo lo que necesita la obra, en un solo proveedor"* |
| **Familias de producto** | Fontanería, Electricidad, Revestimientos, Suelos, Pintura, Madera, Ferretería, Cubiertas, ACS, Cerraduras, Construcción |
| **Acción pendiente** | Activar las 195 offerings pending_review vinculando UPs |

---

## 2. Fontanería Saltos Quiroga S.L.

| Campo | Valor |
|-------|-------|
| **Nombre legal** | Fontanería Saltos Quiroga S.L. |
| **Slug** | `fontaneria-saltos-quiroga` |
| **Actor ID** | `ff426e57-...` |
| **Catálogo fuente** | `47fb567e` — supplier_key=`saltoki`, 170 referencias |
| **Estado** | ✅ Activo — 20 offerings matched |
| **Especialidad** | Fontanería industrial y doméstica, climatización, ACS |
| **Posicionamiento demo** | Especialista en instalaciones sanitarias y térmicas. Catálogo técnico profundo, asesoramiento especializado. |
| **Tagline** | *"Especialistas en agua y calor desde el norte"* |
| **Familias cubiertas** | Grifería (bañera, lavadero, cocina, lavabo), Sanitarios (plato extraplano, plato resina, lavabo, mampara), ACS (calentador gas, termo 50L, válvula seguridad), Válvulas (esfera, termostática, antirretorno), Control (cabezal termostático), Tubería (multicapa ml), Saneamiento (sifón ducha, bote sifónico, sifón botella, desagüe lavadora) |
| **UPs reutilizados** | 17 de los 60 existentes |
| **UPs nuevos (inaugurados FSQ)** | Válvula antirretorno latón, Sifón botella lavabo, Bote sifónico PVC |
| **Diferenciación vs Obras y Materiales** | Especialización en fontanería técnica; donde ObrasMat es generalista, FSQ es el técnico de instalación |
| **Diferenciación vs STN** | STN = ACS y calefacción; FSQ = fontanería sanitaria general (grifería, sanitarios, desagüe) |
| **Acción pendiente** | Sprint C: añadir climatización (SAL-CLI diferidos), calderas FSQ, grifería menor |

---

## 3. Suministros Técnicos Norte S.L. *(actor existente — rol clarificado)*

| Campo | Valor |
|-------|-------|
| **Nombre legal** | Suministros Técnicos Norte S.L. |
| **Slug** | `suministros-tecnicos-norte` *(conservar)* |
| **Actor ID** | `aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9` |
| **Catálogo** | `1aec572f` (catálogo demo propio, 19 offerings) |
| **Estado** | ✅ Activo — 18 offerings matched |
| **Especialidad** | Grifería premium, mecanismos de baño, accesorios técnicos |
| **Posicionamiento demo** | Proveedor de gama alta para instalaciones de baño y cocina. Productos de diseño y alta durabilidad. |
| **Tagline** | *"Grifería y accesorios para instalaciones exigentes"* |
| **Rol en el demo** | Segundo proveedor de fontanería — muestra competencia de precios y calidad frente a Fontanería Saltos Quiroga |
| **Acción pendiente** | Clarificar rol + ampliar catálogo demo con 10-15 offerings adicionales |

---

## 4. ElectroDistribución Cantábrica S.L. *(nuevo actor — pendiente)*

| Campo | Valor |
|-------|-------|
| **Nombre legal** | ElectroDistribución Cantábrica S.L. |
| **Slug** | `electrodistribucion-cantabrica` *(nuevo)* |
| **Catálogo fuente** | `ff706aad` — supplier_key=`sonepar`, 76 referencias |
| **Estado** | ❌ Actor no creado — pendiente aprobación |
| **Especialidad** | Distribución eléctrica industrial y doméstica, automatismos |
| **Posicionamiento demo** | Distribuidor mayorista de material eléctrico. Desde mecanismos hasta cuadros de protección. |
| **Tagline** | *"Distribución eléctrica profesional para el norte"* |
| **Familias de producto** | Mecanismos 15, Cables 15, Protecciones 15, Canalizaciones 13, Luminaria 12, Cuadros 6 |
| **Acción pendiente** | Crear actor + UPDATE supplier_name + crear mínimo 8 offerings matched |

---

## 5. ElectroSuministros Cantábrico S.L. *(actor existente — rol clarificado)*

| Campo | Valor |
|-------|-------|
| **Nombre legal** | ElectroSuministros Cantábrico S.L. |
| **Slug** | `electrosuministros-cantabrico` *(conservar)* |
| **Actor ID** | `fba14bb4-aa80-438e-9a1c-4637963abedd` |
| **Catálogo** | `498a2e63` (catálogo demo propio, 6 offerings) |
| **Estado** | ✅ Activo — 6 offerings matched |
| **Especialidad** | Mecanismos eléctricos de baño, luminarias domésticas, instalación domótica |
| **Posicionamiento demo** | Especialista en electricidad doméstica y aplicaciones específicas (zonas húmedas, iluminación LED). |
| **Tagline** | *"Electricidad doméstica con soluciones de instalación completas"* |
| **Rol en el demo** | Segundo proveedor eléctrico — muestra competencia frente a ElectroDistribución |
| **Diferenciación vs ElectroDistribución** | Cantábrico = doméstico + baño + LED; ElectroDistribución = mayorista industrial |
| **Acción pendiente** | Ampliar catálogo demo con 10-15 offerings adicionales |

---

## 6. Revestimientos y Obra Norte S.L.

| Campo | Valor |
|-------|-------|
| **Nombre legal** | Revestimientos y Obra Norte S.L. |
| **Slug** | `revestimientos-obra-norte` *(conservar)* |
| **Actor ID** | `ce5c781d-1d0b-48f7-b6d2-3dcc682b5747` |
| **Catálogo** | `6ea37e62` (catálogo demo, 5 offerings) |
| **Estado** | ✅ Activo — 5 offerings matched |
| **Especialidad** | Revestimientos cerámicos, pavimentos, morteros, impermeabilizantes |
| **Posicionamiento demo** | Especialista en acabados de obra húmeda y seca. Amplio catálogo de formatos y acabados. |
| **Tagline** | *"Revestimientos y acabados para profesionales de la reforma"* |
| **Acción pendiente** | Ampliar catálogo: azulejos, baldosas, morteros adhesivos, impermeabilizantes |

---

## 7. Pinturas Profesionales del Norte S.L.

| Campo | Valor |
|-------|-------|
| **Nombre legal** | Pinturas Profesionales del Norte S.L. |
| **Slug** | `pinturas-profesionales-norte` *(conservar)* |
| **Actor ID** | `d8f0bf84-bc21-4c9c-bc89-64da9926c149` |
| **Catálogo** | `5c72b86b` (catálogo demo, 2 offerings) |
| **Estado** | ✅ Activo — 2 offerings matched |
| **Especialidad** | Pinturas plásticas, esmaltes, imprimaciones, tratamientos antihumedad |
| **Posicionamiento demo** | Fabricante y distribuidor de pinturas para uso profesional. Asesoramiento técnico incluido. |
| **Tagline** | *"Pinturas técnicas para resultados duraderos"* |
| **Acción pendiente** | Ampliar catálogo: esmaltes, barnices, imprimaciones, pinturas especiales |

---

## 8. Carpintería y Cerramientos Norte S.L.

| Campo | Valor |
|-------|-------|
| **Nombre legal** | Carpintería y Cerramientos Norte S.L. |
| **Slug** | `carpinteria-cerramientos-norte` *(conservar)* |
| **Actor ID** | `0464ae2d-737d-42fe-9aae-3e796de716c8` |
| **Catálogo** | `9907af28` (catálogo demo, 3 offerings) |
| **Estado** | ✅ Activo — 3 offerings matched |
| **Especialidad** | Puertas de paso, ventanas PVC/aluminio, mamparas, tarima |
| **Posicionamiento demo** | Especialista en carpintería interior y exterior para reformas. Plazos ajustados y colocación incluida. |
| **Tagline** | *"Cerramientos y carpintería de calidad para reformas integrales"* |
| **Acción pendiente** | Ampliar catálogo: puertas de paso, ventanas, rodapiés, tarima flotante |

---

## 9. Sistemas Térmicos del Norte S.L. *(actor creado — Sprint B completado)*

| Campo | Valor |
|-------|-------|
| **Nombre legal** | Sistemas Térmicos del Norte S.L. |
| **Slug** | `sistemas-termicos-norte` |
| **Actor ID** | `ce208430-...` |
| **Catálogo** | `8a44c358` — nuevo catálogo STN (35 offerings matched) |
| **Estado** | ✅ Activo — 35 offerings matched |
| **Especialidad** | ACS, calderas de condensación, bombas de calor, aerotermia, split inverter, control térmico |
| **Posicionamiento demo** | Distribuidor especializado en sistemas térmicos. Soluciones para toda la gama de instalaciones de calefacción y ACS. |
| **Tagline** | *"Calor eficiente: ACS, climatización y energías renovables"* |
| **Familias de producto** | ACS (8), Calderas (8), Bomba de calor (4), Split inverter (4), Radiadores (4), Control (4), Accesorios (3) |
| **Referencias** | STM-ACS-001..008, STM-CAL-001..006, STM-BIO-001..002, STM-BDC-001..004, STM-SPL-001..004, STM-RAD-001..004, STM-CON-001..002, STM-REG-001..002, STM-ACC-001..003 |
| **Catálogos legacy normalizados** | Saunier Duval, Daikin, Baxi, Ariston, Junkers, Vaillant — supplier_name limpiado (sin marcas reales) |
| **Acción pendiente** | Ampliar catálogo: grifería premium (§4.1 RC1_C4B_SUPPLIER_IDENTITY_GUIDE), sanitarios de diseño |

---

## 10. Tabla maestra de identidades

| # | Nombre demo | Slug | Fuente legacy | Prods legacy | Matched hoy | Estado |
|---|------------|------|--------------|-------------|------------|--------|
| 1 | Obras y Materiales S.L. | obramat-demo | obramat | 178 | 36 | ✅ |
| 2 | Fontanería Saltos Quiroga S.L. | fontaneria-saltos-quiroga | saltoki | 170 | 20 | ✅ activo |
| 3 | ElectroDistribución Cantábrica S.L. | electrodistribucion-cantabrica | sonepar | 76 | 0 | ❌ crear |
| 4 | Revestimientos y Obra Norte S.L. | revestimientos-obra-norte | — | 0 | 5 | ✅ (escaso) |
| 5 | Pinturas Profesionales del Norte S.L. | pinturas-profesionales-norte | — | 0 | 2 | ✅ (escaso) |
| 6 | Carpintería y Cerramientos Norte S.L. | carpinteria-cerramientos-norte | — | 0 | 3 | ✅ (escaso) |
| 7 | Sistemas Térmicos del Norte S.L. | sistemas-termicos-norte | HVAC×6 | 186 | 35 | ✅ activo |
| — | Suministros Técnicos Norte S.L. | suministros-tecnicos-norte | demo | 0 | 18 | ✅ (complementario) |
| — | ElectroSuministros Cantábrico S.L. | electrosuministros-cantabrico | demo | 0 | 6 | ✅ (complementario) |
| — | TrabFlow | trabflow-platform | — | 0 | 0 | ℹ️ plataforma |

**Total actores demo (incluyendo complementarios):** 9 actores + 1 plataforma  
**Total offerings matched (hoy):** 125 (tras Sprint B STN + FSQ)  
**Objetivo demo completo:** ≥20 offerings matched por proveedor principal (7 × 20 = 140 mínimo)

*Actualizado 2026-08-08: STN activo con 35 offerings. FSQ activo con 20 offerings. Pendiente: ElectroDistribución Cantábrica (actor creado, 0 offerings).*
