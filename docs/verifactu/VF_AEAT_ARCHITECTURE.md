# VeriFactu / VERI*FACTU — Análisis Técnico y Legal Completo
*TrabFlow Technologies, S.L. — Referencia interna. Actualizado 2026-08-29.*

---

## 1. Marco normativo

| Norma | Contenido |
|---|---|
| RD 1007/2023 (29 dic 2023) | Reglamento de SIF — define SIF, VERI*FACTU, obligaciones |
| Orden HAC/1177/2024 (30 oct 2024, BOE 31 oct) | Especificaciones técnicas: formato XML, XSD, WebService AEAT |
| Resolución 18/12/2024 (BOE-A-2024-27600) | Aprueba los 3 documentos normalizados de representación (Anexos I, II, III) |

---

## 2. Plazos de obligación

| Colectivo | Fecha límite |
|---|---|
| Sociedades IS (grandes empresas) | 01/01/2027 |
| Autónomos y resto | 01/07/2027 |
| **Productores de SIF** | 9 meses desde publicación Orden Técnica (antes que usuarios finales) |

> **TrabFlow como productor** debe cumplir antes que sus clientes instaladores.

---

## 3. Modalidades del sistema

### 3.1 VERI*FACTU (envío automático)
- Cada factura se envía a la AEAT en tiempo cuasi-real vía WebService SOAP.
- El registro queda "verificable" en el portal de la AEAT.
- El QR del PDF debe apuntar al validador oficial de la AEAT (ver §10).
- **Requiere**: certificado electrónico + acuerdo colaboración social Tipo 17.

### 3.2 NO VERI*FACTU (conservación local)
- No se envía a la AEAT automáticamente.
- La factura debe firmarse con XAdES-B-B (firma electrónica avanzada).
- AEAT puede requerir los registros en cualquier momento.
- Más complejo: requiere infraestructura de firma XAdES.

### 3.3 Decisión TrabFlow: **VERI*FACTU**
- Menos complejidad técnica (sin XAdES).
- Mejor propuesta de valor para el instalador (verificable en AEAT).
- Única penalización: necesidad de conectividad + acuerdo Tipo 17.

---

## 4. Rol de TrabFlow: SIF Multi-OT

TrabFlow actúa como **Sistema Informático de Facturación (SIF)** para múltiples Obligados Tributarios (OT = instaladores/empresas clientes).

### Identificación del SIF (campos obligatorios en XML)
| Campo | Valor | Estado |
|---|---|---|
| NombreRazon | TrabFlow Technologies, S.L. | Pendiente NIF definitivo |
| NIF | — | **PENDIENTE** — empresa aún sin NIF/CIF definitivo |
| NombreSistemaInformatico | TrabFlow | Max 30 chars |
| IdSistemaInformatico | TF | Único por productor, 2 chars |
| Version | 1.0 | Max 50 chars |
| NumeroInstalacion | PENDIENTE | **Consulta enviada a verifactu@correo.aeat.es** (SaaS cloud ≠ instalación física) |
| TipoUsoPosibleSoloVerifactu | S | TrabFlow solo opera en modo VF |
| TipoUsoPosibleMultiOT | S | Multiples OT confirmado por AEAT |
| IndicadorMultiplesOT | S | **PENDIENTE confirmación AEAT** para SaaS |

---

## 5. Arquitectura de representación (Acuerdo Tipo 17)

### 5.1 Por qué es obligatorio
El FAQ de AEAT (apartado 16) y el texto del Anexo I de la Resolución 18/12/2024 requieren que el SIF que envíe registros en nombre de un OT sea "firmante o adherido al Acuerdo de colaboración social".

**Sin Acuerdo Tipo 17, TrabFlow NO puede enviar registros VERI*FACTU a la AEAT en nombre de sus clientes.**

### 5.2 Tipo correcto
- ~~Tipo 13~~ — Solo cubre SII (no aplica)
- **Tipo 17** — Cubre SII + SILICIE + ficheros de registros SIF ✓

### 5.3 Contacto AEAT
```
comunicacion.sepri@correo.aeat.es
```

### 5.4 Documentos normalizados (Resolución 18/12/2024)
| Anexo | Uso |
|---|---|
| Anexo I | Instalador → TrabFlow (representación directa para envío a AEAT) |
| Anexo II | — (no aplica a este flujo) |
| Anexo III | — (no aplica a este flujo) |

### 5.5 Reglas del acuerdo de representación
- Custodiado por ambas partes (TrabFlow + instalador).
- **NO se pre-registra con la AEAT** — solo se presenta si la AEAT lo requiere.
- Admite firma electrónica cualificada o avanzada (eIDAS).
- **PROHIBE aceptación por checkbox / ToS** — requiere documento firmado explícitamente.
- El acuerdo debe establecerse antes del primer envío a la AEAT.

---

## 6. Certificado electrónico

### 6.1 Tipo recomendado para TrabFlow
**Sello Electrónico Cualificado** (tipo 4 u 8 en plataforma @firma de la FNMT) — diseñado para procesos automatizados y masivos sin autenticación de persona física.

### 6.2 Reglas de seguridad absolutas
- El certificado (P12/PFX/clave privada/contraseña) **NUNCA se almacena en la base de datos**.
- Se gestiona exclusivamente en backend: variables de entorno secretas o gestor de secretos (Vault, Supabase Secrets).
- No aparece en logs ni en respuestas API.

---

## 7. Cadena de hash (ledger fiscal)

### 7.1 Implementación actual de TrabFlow — CONFIRMADA CORRECTA ✓

Cadena SHA-256 por OT (org_id) en `trade_fiscal_records`.

**Formato del canonical string** (AEAT oficial v0.1.2):
```
IDEmisorFactura=<NIF>
&NumSerieFactura=<serie-año-correlativo>
&FechaExpedicionFactura=<DD-MM-YYYY>
&TipoFactura=<F1|R1…R5>
&CuotaTotal=<importe_iva con 2 decimales>
&ImporteTotal=<total con 2 decimales>
&Huella=<hash_anterior | vacío si primer registro>
&FechaHoraHusoGenRegistro=<YYYY-MM-DDTHH:MM:SS±HH:MM>
```

**Primer registro**: `&Huella=` → campo vacío (no `"0"`, no `null`, no omitido).

**Implementado en** `fn_emitir_factura` (migration `20260828_04_fiscal_records_immutability.sql`):
```sql
v_hash_input :=
    'IDEmisorFactura='            || trim(v_org.nif)
  || '&NumSerieFactura='          || v_numero
  || '&FechaExpedicionFactura='   || v_fecha_vf
  || '&TipoFactura='              || v_tipo_vf
  || '&CuotaTotal='               || to_char(v_cuota_iva, 'FM999999999990.00')
  || '&ImporteTotal='             || to_char(v_total,     'FM999999999990.00')
  || '&Huella='                   || COALESCE(v_prev.hash, '')
  || '&FechaHoraHusoGenRegistro=' || v_gen_str;
```

### 7.2 Inmutabilidad del ledger
- `trade_fiscal_records` es append-only absoluto.
- Trigger `trg_protect_fiscal_record` bloquea UPDATE/DELETE a todos los roles incluyendo `postgres`.
- `authenticated` no tiene INSERT/UPDATE/DELETE — solo SELECT vía RLS por org.
- INSERT solo por `fn_emitir_factura` (SECURITY DEFINER).

### 7.3 Multi-OT — cadena independiente por org
- AEAT confirma: cada OT tiene su propia cadena independiente.
- El primer registro de cada OT tiene `Huella=` vacío.
- Diferente serie de facturas entre OTs es **obligatoria** para evitar rechazo por duplicado.
- No se requiere comunicación especial a la AEAT al añadir un nuevo OT.

---

## 8. Coexistencia de dos SIF

Si un OT usa TrabFlow + otro SIF simultáneamente:
- Cada SIF tiene su propia cadena independiente (primer registro con `Huella=` vacío).
- Se requieren **series de facturas distintas** entre SIFs del mismo OT.
- No requiere comunicación especial a la AEAT.

---

## 9. QR oficial AEAT — GAP DETECTADO

### 9.1 Formato oficial (Orden HAC/1177/2024)
```
https://www2.agenciatributaria.es/wlpl/TIKE-CONT/ValidarQR?nif=<NIF>&numserie=<SERIE-AÑO-NUM>&fecha=<DD-MM-YYYY>&importe=<TOTAL>
```
El QR **no incluye el hash** — solo identifica la factura para que la AEAT muestre su estado.

### 9.2 Implementación actual TrabFlow — INCORRECTA ⚠️
```
VERIFACTU:{numero};{hash};{cif}
```
Adicionalmente usa `chart.googleapis.com` (externo, no funciona offline).

### 9.3 GAP: VF-QR-OFFICIAL
- Estado: **PENDIENTE corrección**
- Impacto: el QR actual no permite verificación en el portal de la AEAT
- Requiere: URL oficial AEAT + generación QR nativa (sin dependencia externa)
- No implementar hasta VF-2 o superior (requiere NumeroInstalacion confirmado)

---

## 10. Texto en PDF — GAP DETECTADO

### 10.1 Texto actual en `printTradeInvoice.ts`
```
"Registro VeriFactu · RD 1007/2023"
"Factura expedida conforme al Reglamento de Sistemas de Facturación Verificable (VeriFactu)."
```

### 10.2 GAP: VF-PDF-WORDING
- El texto referencia correctamente el RD 1007/2023.
- La mención "RD 1007/2023" puede quedar incompleta sin referencia a Orden HAC/1177/2024.
- Estado: **PENDIENTE revisión jurídica** — menor prioridad.

---

## 11. Outbox pattern — arquitectura de transmisión resiliente

Para evitar pérdida de registros si la AEAT no está disponible, se usa un patrón de outbox:

```
fn_emitir_factura (atomic)
  → INSERT trade_fiscal_records
  → INSERT trade_verifactu_outbox (estado: pending)
  → UPDATE trade_invoices (Emitida)
```

Worker Edge Function (`processVerifactuOutbox`):
```
pending → sending → [accepted | accepted_with_errors | rejected | retry_pending | failed_permanent]
```

El outbox solo se activa cuando `org.verifactu_mode = 'trabflow_verifactu'` (no para `external_billing`).

---

## 12. Kill switch (fail-closed)

Antes de cualquier llamada SOAP a la AEAT, deben pasar **todas** las validaciones:

| Check | Variable | Estado requerido |
|---|---|---|
| Transmisión habilitada | `transmission_enabled` | true |
| Sistema activo | `enabled` | true |
| Entorno | `environment` | 'production' (no sandbox) |
| NIF productor | `producer_nif` | No vacío, empresa registrada |
| Número instalación | `installation_number` | No 'PENDIENTE_AEAT' |
| Estado certificado | `certificate_status` | 'active' |
| Acuerdo colaboración | `collaboration_agreement_status` | 'active' |

Si cualquiera falla → retorna `TRANSMISSION_DISABLED` sin contactar la AEAT.

---

## 13. Declaración responsable

- Obligatoria antes de comercializar TrabFlow como SIF.
- Presentación: solo a través de la Sede Electrónica de la AEAT.
- Requiere: NIF definitivo de TrabFlow Technologies, S.L.
- Penalización si se omite: **1.000 € por licencia vendida** (RD 1007/2023, Art. 10).
- No confundir con el acuerdo de representación Tipo 17 (son cosas distintas).

---

## 14. Resumen de decisiones arquitectónicas

| Decisión | Elegida | Descartada | Razón |
|---|---|---|---|
| Modalidad | VERI*FACTU | NO VERI*FACTU | Sin XAdES, mejor UX |
| Certificado | Sello Electrónico Cualificado | Persona física | Procesos automáticos |
| Hash | SHA-256 cadena oficial | — | Implementación correcta ✓ |
| Representación | Acuerdo Tipo 17 | Tipo 13 | Tipo 13 no cubre SIF |
| Outbox | PENDIENTE_AEAT en config | Activación inmediata | Fail-closed hasta listo |
| Multi-OT | Cadena por org_id | Cadena global | Cada OT es entidad fiscal independiente |

---

## 15. Checklist legal/técnico previo a activación en producción

### Bloqueantes absolutos (sin estos, NO se puede activar)
- [ ] NIF/CIF definitivo de TrabFlow Technologies, S.L.
- [ ] Acuerdo Tipo 17 firmado con AEAT (`comunicacion.sepri@correo.aeat.es`)
- [ ] Sello Electrónico Cualificado emitido por FNMT
- [ ] Declaración responsable presentada en Sede Electrónica
- [ ] NumeroInstalacion confirmado por AEAT (`verifactu@correo.aeat.es`)
- [ ] `transmission_enabled = true` en `trade_verifactu_system_config` (actualmente BLOQUEADO)

### No bloqueantes para infraestructura (VF-1)
- [x] Cadena hash correcta ✓
- [x] Ledger inmutable ✓
- [x] fn_emitir_factura atómica ✓
- [ ] trade_verifactu_system_config (VF-1)
- [ ] trade_org_verifactu_config (VF-1)
- [ ] trade_verifactu_outbox (VF-1)
- [ ] XML builder buildVerifactuXml() (VF-1)
- [ ] VerifactuTransport interface + stub (VF-1)
- [ ] Admin UI VeriFactu (VF-1)
- [ ] QR oficial AEAT (VF-QR-OFFICIAL — VF-2+)

---

## 16. Contactos AEAT

| Propósito | Contacto |
|---|---|
| Acuerdo Tipo 17 | `comunicacion.sepri@correo.aeat.es` |
| NumeroInstalacion SaaS | `verifactu@correo.aeat.es` |
| Validación QR facturas | `https://www2.agenciatributaria.es/wlpl/TIKE-CONT/ValidarQR` |
| Sede Electrónica (declaración responsable) | `https://sede.agenciatributaria.gob.es` |

---

## 17. Referencias normativas

- RD 1007/2023: https://www.boe.es/eli/es/rd/2023/12/05/1007
- Orden HAC/1177/2024: https://www.boe.es/eli/es/o/2024/10/28/hac1177
- BOE-A-2024-27600 (Resolución 18/12/2024): https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-27600
- FAQ desarrolladores AEAT: https://www.agenciatributaria.es/AEAT.internet/Inicio/Ayuda/Modelos__Procedimientos_y_Servicios/Ayuda_P_G417/Preguntas_frecuentes/Preguntas_frecuentes.shtml
- WebService AEAT: https://www.agenciatributaria.es/AEAT.internet/Inicio/La_Agencia_Tributaria/Campanas/Facturacion_informatizada_obligatoria/Informacion_tecnica/Informacion_tecnica.shtml
