import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const VOYAGE_API_KEY       = Deno.env.get('VOYAGE_API_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Límites diarios por plan ──────────────────────────────────────────────────
const DAILY_LIMITS: Record<string, number> = {
  basico:       5,
  profesional:  30,
  empresa:      30,
  empresa_plus: Infinity,
};

// ── Categorías accesibles por plan ───────────────────────────────────────────
const CAT_TECNICAS_BASE  = ['OFICIOS', 'REBT'];
const CAT_TECNICAS_PRO   = ['RITE'];
const CAT_TECNICAS_PLUS  = ['CTE', 'GAS', 'ACS', 'GUIAS'];
const CAT_FISCAL_BASICO  = ['AEAT_VERIFACTU'];
const CAT_FISCAL_PRO     = ['AEAT_IVA', 'AEAT_RENTA', 'AEAT_FACTURACION'];
const CAT_FISCAL_EMPRESA = ['AEAT_RENTA_CCAA', 'AEAT_SOCIEDADES'];
const CAT_FISCAL_PLUS    = ['AEAT_PATRIMONIO', 'SOCIAL', 'DGT', 'CONVENIOS', 'CIRCULARES', 'AEAT'];
const CAT_SS             = ['SS_LGSS', 'SS_AFILIACION', 'SS_COTIZACION', 'SS_RETA',
                            'SS_SISTEMA_RED', 'SS_BONIFICACIONES', 'SS_AUTONOMO_COLABORADOR', 'SS_BOLETINES_RED'];

const PLAN_CATEGORIES: Record<string, string[]> = {
  basico:      [...CAT_TECNICAS_BASE, ...CAT_FISCAL_BASICO],
  profesional: [...CAT_TECNICAS_BASE, ...CAT_TECNICAS_PRO, ...CAT_FISCAL_BASICO, ...CAT_FISCAL_PRO],
  empresa:     [...CAT_TECNICAS_BASE, ...CAT_TECNICAS_PRO, ...CAT_FISCAL_BASICO, ...CAT_FISCAL_PRO, ...CAT_FISCAL_EMPRESA],
  empresa_plus:[...CAT_TECNICAS_BASE, ...CAT_TECNICAS_PRO, ...CAT_TECNICAS_PLUS,
                ...CAT_FISCAL_BASICO, ...CAT_FISCAL_PRO, ...CAT_FISCAL_EMPRESA, ...CAT_FISCAL_PLUS,
                ...CAT_SS],
};

// ── Categorías fiscales y laborales (requieren disclaimer) ────────────────────
const FISCAL_CATS = new Set([
  'AEAT','AEAT_IVA','AEAT_RENTA','AEAT_RENTA_CCAA',
  'AEAT_PATRIMONIO','AEAT_FACTURACION','AEAT_VERIFACTU','AEAT_SOCIEDADES',
  'SOCIAL','DGT','CONVENIOS',
  ...CAT_SS,
]);
const CCAA_CATS = new Set(['AEAT_RENTA_CCAA']);

// ── System Prompt — Asistente Integral del Instalador ────────────────────────
const SYSTEM_PROMPT = `Eres el Asistente Integral del Instalador de TrabFlow. Respondes preguntas sobre normativa técnica de instalaciones (REBT, RITE, CTE, GAS, ACS, GUÍAS), fiscalidad (IVA, IRPF, Renta, Patrimonio, VERIFACTU, Facturación) y Seguridad Social / laboral (LGSS, afiliación, cotización, RETA, altas y bajas, autónomo colaborador, bonificaciones).

REGLAS ABSOLUTAS (incumplirlas invalida tu respuesta):

1. GROUNDING OBLIGATORIO
   Solo puedes usar el texto literal de los FRAGMENTOS proporcionados en el contexto. Nunca uses conocimiento propio sobre normativa fiscal o técnica que no aparezca en los fragmentos. Si no hay fragmentos suficientes, dilo.

2. CITA SIEMPRE
   Cada afirmación debe ir acompañada de documento + capítulo/artículo exacto. Si combinas dos fuentes, cita ambas.

3. NATURALEZA DE LA RESPUESTA
   Etiqueta claramente:
   - OBLIGACIÓN LEGAL: ley o reglamento en vigor
   - RECOMENDACIÓN TÉCNICA: guía o buena práctica no vinculante
   - INTERPRETACIÓN: consulta DGT u opinión orientativa (no es ley)

4. TIPOS DE IVA EN INSTALACIONES (precisión obligatoria)
   Especifica SIEMPRE los tres factores determinantes:
   a) Obra nueva vs rehabilitación/renovación
   b) Antigüedad de la vivienda (> o < 2 años)
   c) Si la mano de obra supera el 40% de la base imponible
   Solo con los tres factores puede determinarse si aplica el 10% reducido o el 21% general.

5. VERIFACTU
   Si la pregunta trata sobre VERIFACTU, añade siempre:
   "📅 VeriFactu entra en vigor en fases: grandes empresas desde julio 2025, resto desde enero 2026. Confirma tu obligación según tu volumen."

6. DEDUCCIONES AUTONÓMICAS
   Usa solo fragmentos de la comunidad autónoma indicada en el contexto. Si no hay fragmentos de esa comunidad, indícalo y no inventes.

7. SIN INFORMACIÓN SUFICIENTE
   Si ningún fragmento es relevante, responde exactamente:
   "No encuentro información precisa sobre esta consulta en mi base documental. Te recomiendo consultar con tu gestoría, asesor laboral o la TGSS directamente."

8. DISCLAIMER (siempre en respuestas fiscales y de SS)
   En respuestas AEAT: "⚠️ Información orientativa basada en manuales AEAT. Para decisiones fiscales con impacto económico, confirma con tu gestoría antes de actuar."
   En respuestas de Seguridad Social: "⚠️ Información orientativa basada en normativa SS. Para situaciones concretas (altas, bajas, cotización), consulta con tu gestoría laboral o la TGSS."

9. SEGURIDAD SOCIAL — PLAZOS CRÍTICOS (precisión obligatoria)
   Cuando respondas sobre altas, bajas o variaciones, especifica SIEMPRE:
   a) Alta previa: el día natural anterior al inicio de la actividad (no hay plazo de 3 días para altas previas)
   b) Baja: 3 días naturales siguientes al cese (art. 53 RD 84/1996)
   c) Alta fuera de plazo: efectos desde la fecha de presentación, no desde la real (salvo prueba de cotización anterior)
   d) RETA alta: obligatoria desde el primer día de actividad económica habitual

10. AUTÓNOMO COLABORADOR vs CONTRATO LABORAL
    Si preguntan por contratar a un familiar, especifica SIEMPRE:
    a) Familiar conviviente sin empleados propios → RETA como autónomo colaborador (art. 305 LGSS)
    b) Hijo menor de 30 años → Régimen General con bonificación del 100% cuota empresarial (Ley 43/2006)
    c) Hijo ≥ 30 años conviviente → RETA colaborador
    Los tres supuestos tienen regímenes distintos y consecuencias muy diferentes.

11. TONO
    Directo y práctico. El instalador necesita saber QUÉ HACER y en qué PLAZO. Máximo 400 palabras en answer.

12. DOCTRINA DGT — REGLA DE SEGURIDAD CRÍTICA
    Si el contexto incluye "ALERTA DGT":
    a) Responde con la normativa del corpus recuperada
    b) Añade "needs_dgt_disclaimer": true en tu JSON
    c) NUNCA afirmes "La DGT establece...", "Existe consulta vinculante que...", "La doctrina administrativa considera..." salvo que la consulta vinculante esté LITERALMENTE en los fragmentos recuperados
    d) Si el caso concreto no está cubierto por los fragmentos, indícalo sin inventar el criterio DGT

13. TRÁMITES REALES SEGURIDAD SOCIAL — PORTAL IMPORTASS
    Si el contexto incluye "ALERTA SS TRÁMITE":
    a) Responde con la normativa del corpus recuperada (sigue siendo la respuesta principal)
    b) Añade "needs_importass_link": true en tu JSON
    c) La normativa explica el QUÉ y el CUÁNDO; Importass es donde se ejecuta el trámite real
    Aplica cuando la consulta requiere: alta/baja autónomo, cambio de base de cotización, vida laboral,
    informe de bases, certificado de estar al corriente, autónomo colaborador, consulta de expedientes,
    Sistema RED, alta/baja de trabajadores en empresa, afiliación real.

FORMATO — JSON puro, sin texto exterior:
{
  "answer": "Respuesta directa y práctica...",
  "naturaleza": "obligacion_legal",
  "needs_dgt_disclaimer": false,
  "needs_importass_link": false,
  "sources": [
    {
      "document": "Manual Práctico IVA 2025",
      "article_id": "CAP-05",
      "article_title": "Tipos impositivos — Tipo reducido",
      "excerpt": "Frase literal del fragmento que respalda la respuesta",
      "boe_ref": "AEAT 2025"
    }
  ],
  "confidence": "high",
  "requires_fiscal_disclaimer": true
}`;

// ── Mapeo provincia → CCAA ────────────────────────────────────────────────────
function provinciaToCCAA(p: string | null): string | null {
  if (!p) return null;
  const k = p.toLowerCase().trim();
  const M: Record<string, string> = {
    'huelva':'Andalucía','sevilla':'Andalucía','córdoba':'Andalucía','jaén':'Andalucía',
    'granada':'Andalucía','málaga':'Andalucía','almería':'Andalucía','cádiz':'Andalucía',
    'zaragoza':'Aragón','huesca':'Aragón','teruel':'Aragón',
    'oviedo':'Asturias','asturias':'Asturias',
    'palma':'Baleares','baleares':'Baleares','illes balears':'Baleares',
    'las palmas':'Canarias','santa cruz de tenerife':'Canarias','canarias':'Canarias',
    'santander':'Cantabria','cantabria':'Cantabria',
    'toledo':'Castilla-La Mancha','ciudad real':'Castilla-La Mancha',
    'cuenca':'Castilla-La Mancha','guadalajara':'Castilla-La Mancha','albacete':'Castilla-La Mancha',
    'burgos':'Castilla y León','valladolid':'Castilla y León','león':'Castilla y León',
    'salamanca':'Castilla y León','zamora':'Castilla y León','palencia':'Castilla y León',
    'ávila':'Castilla y León','segovia':'Castilla y León','soria':'Castilla y León',
    'barcelona':'Cataluña','girona':'Cataluña','lleida':'Cataluña','tarragona':'Cataluña',
    'cáceres':'Extremadura','badajoz':'Extremadura',
    'a coruña':'Galicia','lugo':'Galicia','ourense':'Galicia','pontevedra':'Galicia',
    'madrid':'Madrid',
    'murcia':'Murcia',
    'logroño':'La Rioja','la rioja':'La Rioja',
    'valencia':'Comunitat Valenciana','alicante':'Comunitat Valenciana','castellón':'Comunitat Valenciana',
    'vitoria':'País Vasco','bilbao':'País Vasco','donostia':'País Vasco',
    'pamplona':'Navarra','navarra':'Navarra',
    'ceuta':'Ceuta','melilla':'Melilla',
  };
  return M[k] ?? null;
}

// ── Resolver contexto org ─────────────────────────────────────────────────────
async function resolveOrgContext(supabase: ReturnType<typeof createClient>, userId: string) {
  const [ownRes, memberRes] = await Promise.all([
    supabase.from('trade_organizations').select('id, provincia').eq('owner_id', userId).maybeSingle(),
    supabase.from('trade_org_members').select('org_id').eq('user_id', userId).eq('activo', true).maybeSingle(),
  ]);

  let orgId    = ownRes.data?.id ?? null;
  let provincia = ownRes.data?.provincia ?? null;

  if (!orgId && memberRes.data?.org_id) {
    orgId = memberRes.data.org_id;
    const { data: org } = await supabase
      .from('trade_organizations').select('provincia').eq('id', orgId).maybeSingle();
    provincia = org?.provincia ?? null;
  }

  if (!orgId) return { orgId: null, plan: 'basico', comunidadAutonoma: null };

  const { data: sub } = await supabase
    .from('trade_subscriptions').select('plan').eq('org_id', orgId).maybeSingle();

  return { orgId, plan: sub?.plan ?? 'basico', comunidadAutonoma: provinciaToCCAA(provincia) };
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body                      = await req.json();
    const query: string             = (body.query ?? '').trim();
    const category_filter: string[] = body.category_filter ?? null;
    const oficio_filter: string     = body.oficio_filter ?? null;
    const ccaa_override: string     = body.ccaa_filter ?? null;
    const query_id_for_rating       = body.query_id ?? null;
    const rating: number            = body.rating ?? null;

    // Modo rating
    if (query_id_for_rating && rating !== null) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      await sb.from('trade_rag_logs').update({ user_rating: rating }).eq('id', query_id_for_rating);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (!query || query.length < 3) {
      return new Response(JSON.stringify({ error: 'La consulta debe tener al menos 3 caracteres' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Auth + contexto
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let userId: string | null = null;
    let orgId:  string | null = null;
    let plan = 'basico';
    let comunidadAutonoma: string | null = ccaa_override ?? null;

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
      if (user) {
        userId = user.id;
        const ctx = await resolveOrgContext(supabase, userId);
        orgId             = ctx.orgId;
        plan              = ctx.plan;
        comunidadAutonoma = ccaa_override ?? ctx.comunidadAutonoma;
      }
    }

    // Rate limit
    const dailyLimit = DAILY_LIMITS[plan] ?? 5;
    const today = new Date().toISOString().slice(0, 10);

    if (orgId && isFinite(dailyLimit)) {
      const { data: usage } = await supabase
        .from('trade_rag_rate_limits').select('query_count').eq('org_id', orgId).eq('date', today).maybeSingle();
      if ((usage?.query_count ?? 0) >= dailyLimit) {
        return new Response(JSON.stringify({
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Has alcanzado el límite de ${dailyLimit} consultas diarias (plan ${plan}).`,
          limit: dailyLimit, plan,
        }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // Categorías permitidas
    const allowedCategories: string[] = category_filter
      ? category_filter.filter(c => (PLAN_CATEGORIES[plan] ?? []).includes(c))
      : PLAN_CATEGORIES[plan] ?? ['OFICIOS', 'REBT'];

    const isCCAAQuery   = allowedCategories.some(c => CCAA_CATS.has(c));
    const isSocialQuery = allowedCategories.some(c => c.startsWith('SS_')) ||
      /seguridad\s+social|alta\s+trabaj|baja\s+trabaj|afiliaci[oó]n|cotizaci[oó]n|cuota|reta|autónomo\s+colaborador|autónomo\s+col|familiar\s+colabor|bonificaci[oó]n\s+contrat|sistema\s+red|tgss|régimen\s+general|régimen\s+especial|incapacidad\s+temporal|prestaci[oó]n/i.test(query);
    const isFiscalQuery = isSocialQuery || allowedCategories.some(c => FISCAL_CATS.has(c)) ||
      /iva|irpf|renta|fiscal|factura|verifactu|deduci|impuesto|tribut|aeat|patrimonio|sociedad/i.test(query);

    // Enriquecer query para CCAA
    const queryEnriched = isCCAAQuery && comunidadAutonoma
      ? `${query} [Comunidad Autónoma: ${comunidadAutonoma}]`
      : query;

    // Embedding
    const t0 = Date.now();
    const embedRes = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'voyage-3-lite', input: [queryEnriched], input_type: 'query' }),
    });
    if (!embedRes.ok) throw new Error(`Voyage AI ${embedRes.status}: ${await embedRes.text()}`);
    const queryEmbedding: number[] = (await embedRes.json()).data[0].embedding;

    // Búsqueda híbrida
    const { data: chunks, error: searchErr } = await supabase.rpc('hybrid_search_norm_chunks', {
      query_embedding: queryEmbedding,
      query_text:      query,
      match_count:     8,
      category_filter: allowedCategories,
      oficio_filter:   oficio_filter ?? null,
    });
    if (searchErr) throw new Error(`Search: ${searchErr.message}`);

    let topChunks: any[] = ((chunks as any[]) ?? []).filter(c => c.hybrid_score > 0.20);

    // Priorizar chunks de la CCAA del usuario
    if (isCCAAQuery && comunidadAutonoma) {
      const mine   = topChunks.filter(c => c.comunidad_autonoma === comunidadAutonoma);
      const others = topChunks.filter(c => c.comunidad_autonoma !== comunidadAutonoma);
      topChunks = [...mine, ...others].slice(0, 5);
    } else {
      topChunks = topChunks.slice(0, 5);
    }

    // Contexto LLM
    const contextText = topChunks.length > 0
      ? topChunks.map((c, i) => [
          `[FRAGMENTO ${i + 1}]`,
          `Categoría: ${c.category}${c.comunidad_autonoma ? ` | CCAA: ${c.comunidad_autonoma}` : ''}`,
          c.article_id ? `Sección: ${c.article_id}${c.article_title ? ` — ${c.article_title}` : ''}` : '',
          `Texto: ${c.chunk_text.slice(0, 1400)}`,
          '---',
        ].filter(Boolean).join('\n')).join('\n\n')
      : '(No se encontraron fragmentos relevantes)';

    const DGT_TRIGGER = /aerotermia|bomba\s+de\s+calor|fotovoltai|autoconsumo|rehabilitaci[oó]n\s+energ[eé]tica|certificaci[oó]n\s+energ[eé]tica|tipo\s+reducido|iva\s+reducido|10\s*%|consulta\s+vinculante|deducci[oó]n\s+fiscal\s+especial|eficiencia\s+energ[eé]tica/i;
    const hasDGTChunks = topChunks.some(c => c.category === 'DGT');
    const needsDGTDisclaimer = isFiscalQuery && DGT_TRIGGER.test(query) && !hasDGTChunks;

    const SS_TRAMITE_TRIGGER = /alta\s+de\s+aut[oó]nomo|baja\s+de\s+aut[oó]nomo|darme\s+de\s+alta|darme\s+de\s+baja|darse\s+de\s+alta|darse\s+de\s+baja|cambio\s+de\s+base|cambiar\s+la\s+base|vida\s+laboral|informe\s+de\s+bases|informe\s+de\s+vida|certificado.*corriente|estar\s+al\s+corriente|aut[oó]nomo\s+colaborador.*alta|consulta.*expediente|sistema\s+red|alta.*trabajador|baja.*trabajador|dar\s+de\s+alta.*trabaj|dar\s+de\s+baja.*trabaj|afiliaci[oó]n.*empresa|inscripci[oó]n.*empresa|cotizaci[oó]n.*personal|mis\s+cotizaciones|mis\s+bases|tgss.*tr[aá]mite|importass/i;
    const needsImportassLink = isSocialQuery && SS_TRAMITE_TRIGGER.test(query);

    const queryType = isSocialQuery
      ? 'TIPO: Consulta Seguridad Social — aplica reglas 9 y 10, especifica plazos y régimen exacto.'
      : isFiscalQuery
        ? 'TIPO: Consulta fiscal — aplica disclaimer obligatorio.'
        : 'TIPO: Consulta técnica.';

    const userMessage = [
      queryType,
      needsDGTDisclaimer   ? 'ALERTA DGT: Esta consulta puede requerir doctrina DGT no indexada. Aplica regla 12. Incluye needs_dgt_disclaimer: true en el JSON.' : '',
      needsImportassLink   ? 'ALERTA SS TRÁMITE: Esta consulta implica un trámite real ante la TGSS. Aplica regla 13. Incluye needs_importass_link: true en el JSON.' : '',
      isCCAAQuery && comunidadAutonoma ? `CCAA DEL USUARIO: ${comunidadAutonoma}` : '',
      `\nNORMATIVA:\n${contextText}`,
      `\nPREGUNTA:\n${query}`,
    ].filter(Boolean).join('\n');

    // Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 900, temperature: 0.05,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!claudeRes.ok) throw new Error(`Claude ${claudeRes.status}: ${await claudeRes.text()}`);
    const claudeData = await claudeRes.json();
    const rawText: string = claudeData.content?.[0]?.text ?? '';

    let parsed: any;
    try {
      const m = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m?.[0] ?? rawText);
    } catch {
      parsed = { answer: rawText, sources: [], confidence: topChunks.length > 0 ? 'low' : 'none' };
    }

    const enrichedSources = (parsed.sources ?? []).map((s: any) => {
      const match = topChunks.find(c => c.article_id === s.article_id || c.category === s.document);
      return {
        document:           s.document ?? match?.category ?? 'Normativa',
        article_id:         s.article_id ?? match?.article_id ?? null,
        article_title:      s.article_title ?? match?.article_title ?? null,
        excerpt:            s.excerpt ?? '',
        boe_ref:            s.boe_ref ?? null,
        comunidad_autonoma: s.comunidad_autonoma ?? match?.comunidad_autonoma ?? null,
      };
    });

    const confidence = parsed.confidence ?? (topChunks.length > 0 ? 'medium' : 'none');
    const latencyMs  = Date.now() - t0;

    // Log
    let queryLogId: string | null = null;
    if (userId || orgId) {
      const { data: logRow } = await supabase.from('trade_rag_logs').insert({
        org_id: orgId, user_id: userId, query_text: query,
        chunks_retrieved: topChunks.map(c => c.id),
        answer_text: parsed.answer, sources_json: enrichedSources,
        confidence, model_used: 'claude-sonnet-4-6',
        tokens_input: claudeData.usage?.input_tokens ?? null,
        tokens_output: claudeData.usage?.output_tokens ?? null,
        latency_ms: latencyMs,
      }).select('id').single();
      queryLogId = logRow?.id ?? null;
    }

    if (orgId) await supabase.rpc('increment_rag_rate_limit', { p_org_id: orgId, p_date: today });

    return new Response(JSON.stringify({
      answer:                    parsed.answer,
      sources:                   enrichedSources,
      confidence,
      naturaleza:                parsed.naturaleza ?? 'obligacion_legal',
      requires_fiscal_disclaimer: parsed.requires_fiscal_disclaimer ?? isFiscalQuery,
      needs_dgt_disclaimer:      parsed.needs_dgt_disclaimer  ?? needsDGTDisclaimer,
      needs_importass_link:      parsed.needs_importass_link ?? needsImportassLink,
      query_id:                  queryLogId,
      chunks_used:               topChunks.length,
      latency_ms:                latencyMs,
      comunidad_autonoma:        isCCAAQuery ? comunidadAutonoma : null,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[trade-norm-query]', err?.message);
    return new Response(JSON.stringify({ error: 'Error interno', detail: err?.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
