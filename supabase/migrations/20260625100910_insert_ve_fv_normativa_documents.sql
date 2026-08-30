
-- ── Documentos VE (Cargadores Vehículo Eléctrico) ────────────────────────────
INSERT INTO public.trade_norm_documents
  (category, title, subtitle, boe_ref, source_url, version, valid_from,
   status, chunk_count, oficio_tags, plan_required,
   organismo_emisor, fecha_publicacion, ambito_territorial, tipo_documento)
VALUES
  (
    'VE',
    'RD 266/2021 — Programa MOVES III',
    'Incentivos a la movilidad eficiente y sostenible. Subvenciones puntos de recarga y vehículos eléctricos.',
    'BOE-A-2021-4522',
    'https://www.boe.es/eli/es/rd/2021/04/13/266',
    '2021', '2021-04-14', 'pending', 0,
    ARRAY['electricidad','ve'], 'profesional',
    'BOE', '2021-04-14', 'estatal', 'reglamento'
  ),
  (
    'VE',
    'Reglamento UE 2023/1804 (AFIR) — Infraestructura Combustibles Alternativos',
    'Objetivos y plazos de despliegue de puntos de recarga VE en la UE. Obligaciones por potencia y tipo de vía para 2025-2030.',
    'DOUE-L-2023-81718',
    'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32023R1804',
    '2023', '2023-10-13', 'pending', 0,
    ARRAY['ve'], 'profesional',
    'EUR-Lex', '2023-10-13', 'estatal', 'reglamento'
  ),
  (
    'VE',
    'Ley 49/1960 de Propiedad Horizontal — Comunidades y VE',
    'Mayorías necesarias en comunidades de propietarios para instalación de puntos de recarga VE. Modificación introducida por Ley 7/2021 de cambio climático.',
    'BOE-A-1960-10906',
    'https://www.boe.es/eli/es/l/1960/07/21/49/con',
    'Texto consolidado 2021', '2021-06-04', 'pending', 0,
    ARRAY['ve'], 'profesional',
    'BOE', '2021-06-04', 'estatal', 'ley'
  ),
  (
    'VE',
    'ITC-BT-52 — Instalaciones para VE (REBT)',
    'Instrucción Técnica Complementaria del REBT para infraestructura de recarga VE. Modos de carga 1-4, esquemas tipo, protecciones obligatorias, documentación.',
    'BOE-A-2014-3376',
    'https://www.boe.es/eli/es/rd/2014/03/28/560',
    '2014 + mod. 2021', '2014-04-07', 'pending', 0,
    ARRAY['electricidad','ve'], 'profesional',
    'BOE', '2014-04-07', 'estatal', 'reglamento'
  ),
  (
    'VE',
    'OCPP 1.6 / 2.0 — Open Charge Point Protocol',
    'Protocolo de comunicación entre punto de recarga y sistema de gestión central (CSMS). Mensajes, estados de transacción, comandos de control remoto.',
    NULL,
    'https://www.openchargealliance.org/protocols/ocpp-16/',
    '1.6 / 2.0.1', '2019-04-01', 'pending', 0,
    ARRAY['ve'], 'profesional',
    'Open Charge Alliance', '2019-04-01', 'estatal', 'norma_tecnica'
  );

-- ── Documentos FV (Fotovoltaica Industrial) ───────────────────────────────────
INSERT INTO public.trade_norm_documents
  (category, title, subtitle, boe_ref, source_url, version, valid_from,
   status, chunk_count, oficio_tags, plan_required,
   organismo_emisor, fecha_publicacion, ambito_territorial, tipo_documento)
VALUES
  (
    'FV',
    'RD 244/2019 — Autoconsumo Fotovoltaico',
    'Condiciones administrativas, técnicas y económicas del autoconsumo eléctrico. Modalidades sin/con excedentes, colectivo. Compensación simplificada. Registro RAIPRE.',
    'BOE-A-2019-5089',
    'https://www.boe.es/eli/es/rd/2019/04/05/244',
    '2019 + mod. 2021', '2019-04-06', 'pending', 0,
    ARRAY['energia_solar','fv'], 'empresa',
    'BOE', '2019-04-06', 'estatal', 'reglamento'
  ),
  (
    'FV',
    'RD 1183/2020 — Acceso y Conexión a la Red',
    'Procedimientos de acceso y conexión a redes de transporte y distribución. Solicitud ATR para instalaciones FV. Permisos de acceso y conexión, plazos y documentación.',
    'BOE-A-2020-16116',
    'https://www.boe.es/eli/es/rd/2020/12/29/1183',
    '2020', '2021-01-01', 'pending', 0,
    ARRAY['energia_solar','fv'], 'empresa',
    'BOE', '2020-12-30', 'estatal', 'reglamento'
  ),
  (
    'FV',
    'IEC 62446-1 — Documentación y pruebas de sistemas FV (síntesis)',
    'Requisitos mínimos de documentación, pruebas en comisionado y mantenimiento de sistemas FV conectados a red. Certificados de puesta en marcha. Síntesis técnica interna.',
    NULL,
    'https://www.une.org/encuentra-tu-norma/busca-tu-norma/norma/?c=N0062637',
    '2016+A1:2021', '2022-01-01', 'pending', 0,
    ARRAY['energia_solar','fv'], 'empresa',
    'UNE / IEC (síntesis)', '2022-01-01', 'estatal', 'norma_tecnica'
  ),
  (
    'FV',
    'IEC TS 62446-3 — Inspección termográfica FV (síntesis)',
    'Metodología de inspección termográfica en campo de sistemas fotovoltaicos. Condiciones de medida, clasificación de defectos (hot spot, bypass), contenido del informe. Síntesis interna.',
    NULL,
    'https://www.une.org/encuentra-tu-norma/busca-tu-norma/norma/?c=N0058553',
    '2017', '2018-01-01', 'pending', 0,
    ARRAY['energia_solar','fv'], 'empresa',
    'UNE / IEC (síntesis)', '2018-01-01', 'estatal', 'norma_tecnica'
  ),
  (
    'FV',
    'IEC 61724-1 — Monitorización y rendimiento FV (síntesis)',
    'Medición de parámetros de rendimiento de sistemas FV: Performance Ratio, yield específico, horas equivalentes, irradiancia, temperatura. Clases de precisión A/B/C. Síntesis interna.',
    NULL,
    'https://www.une.org/encuentra-tu-norma/busca-tu-norma/norma/?c=N0058091',
    '2017', '2017-01-01', 'pending', 0,
    ARRAY['energia_solar','fv'], 'empresa',
    'UNE / IEC (síntesis)', '2017-01-01', 'estatal', 'norma_tecnica'
  ),
  (
    'FV',
    'Guía Técnica IDAE — Energía Solar Fotovoltaica',
    'Criterios técnicos para diseño, instalación y puesta en marcha de sistemas FV residenciales e industriales. Cálculos de producción, selección de componentes, legalización, seguridad.',
    NULL,
    'https://www.idae.es/tecnologias/energias-renovables/uso-electrico/solar-fotovoltaica',
    '2024', '2024-01-01', 'pending', 0,
    ARRAY['energia_solar','fv'], 'empresa',
    'IDAE', '2024-01-01', 'estatal', 'guia_tecnica'
  );
;
