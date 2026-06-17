import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const VOYAGE_API_KEY      = Deno.env.get('VOYAGE_API_KEY') ?? '';
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY   = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

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
const PLAN_CATEGORIES: Record<string, string[]> = {
  basico:       ['OFICIOS', 'REBT'],
  profesional:  ['OFICIOS', 'REBT', 'RITE'],
  empresa:      ['OFICIOS', 'REBT', 'RITE'],
  empresa_plus: ['OFICIOS', 'REBT', 'RITE', 'CTE', 'GAS', 'ACS', 'GUIAS'],
};

// ── System prompt del Asistente Técnico ──────────────────────────────────────
const SYSTEM_PROMPT = `Eres un asistente técnico especialista en normativa española de instalaciones y construcción. Ayudas a instaladores profesionales a consultar reglamentos oficiales (REBT, RITE, CTE, GAS, ACS, GUIAS) y fichas técnicas de actuaciones por oficio.

REGLAS OBLIGATORIAS:
1. Responde ÚNICAMENTE usando los fragmentos de normativa proporcionados como contexto. No uses conocimiento externo.
2. Cada afirmación técnica debe citarse con su fuente (documento y artículo).
3. Si no hay información suficiente, responde con confidence "none" y explícalo claramente.
4. Sé directo y práctico. El instalador necesita saber QUÉ HACER, no un resumen académico.
5. Máximo 300 palabras en el campo answer.

FORMATO DE RESPUESTA — JSON puro, sin texto exterior:
{
  "answer": "Respuesta técnica directa y práctica...",
  "sources": [
    {
      "document": "REBT",
      "article_id": "ITC-BT-19",
      "article_title": "Título del artículo/sección",
      "excerpt": "Frase o párrafo clave de la norma que respalda la respuesta",
      "boe_ref": "Código electrónico 326"
    }
  ],
  "confidence": "high"
}

Niveles de confidence:
- "high": los fragmentos responden directamente la pregunta
- "medium": hay información relacionada pero no exacta
- "low": información parcial o indirecta
- "none": no hay información relevante — usa exactamente: "No encuentro información precisa sobre esta consulta en la normativa disponible. Te recomiendo consultar directamente la normativa oficial o un técnico certificado."`;

// ── Resuelve org_id + plan del usuario autenticado ────────────────────────────
async function resolveOrgAndPlan(supabase: ReturnType<typeof createClient>, userId: string) {
  const [ownRes, memberRes] = await Promise.all([
    supabase.from('trade_organizations').select('id').eq('owner_id', userId).maybeSingle(),
    supabase.from('trade_org_members').select('org_id').eq('user_id', userId).eq('activo', true).maybeSingle(),
  ]);
  const orgId = ownRes.data?.id ?? memberRes.data?.org_id ?? null;
  if (!orgId) return { orgId: null, plan: 'basico' };

  const { data: sub } = await supabase
    .from('trade_subscriptions')
    .select('plan, status')
    .eq('org_id', orgId)
    .maybeSingle();

  return { orgId, plan: sub?.plan ?? 'basico' };
}

// ── Handler principal ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // 1. Parsear request
    const body = await req.json();
    const query: string          = (body.query ?? '').trim();
    const oficio_filter: string  = body.oficio_filter ?? null;
    const category_filter: string[] = body.category_filter ?? null;
    const query_id_for_rating: string = body.query_id ?? null;
    const rating: number         = body.rating ?? null;   // 1 = útil, -1 = no útil

    // Modo rating: actualizar feedback de una consulta anterior
    if (query_id_for_rating && rating !== null) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      await supabase.from('trade_rag_logs')
        .update({ user_rating: rating })
        .eq('id', query_id_for_rating);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (!query || query.length < 3) {
      return new Response(JSON.stringify({ error: 'La consulta debe tener al menos 3 caracteres' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 2. Autenticación (opcional — works sin sesión para demo)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let userId: string | null = null;
    let orgId:  string | null = null;
    let plan = 'basico';

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
      if (user) {
        userId = user.id;
        const resolved = await resolveOrgAndPlan(supabase, userId);
        orgId = resolved.orgId;
        plan  = resolved.plan;
      }
    }

    // 3. Rate limiting
    const dailyLimit = DAILY_LIMITS[plan] ?? 5;
    const today = new Date().toISOString().slice(0, 10);

    if (orgId && isFinite(dailyLimit)) {
      const { data: usage } = await supabase
        .from('trade_rag_rate_limits')
        .select('query_count')
        .eq('org_id', orgId)
        .eq('date', today)
        .maybeSingle();

      if ((usage?.query_count ?? 0) >= dailyLimit) {
        return new Response(JSON.stringify({
          error:   'RATE_LIMIT_EXCEEDED',
          message: `Has alcanzado el límite de ${dailyLimit} consultas diarias en el plan ${plan}. Actualiza tu plan para continuar.`,
          limit:   dailyLimit,
          plan,
        }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // 4. Categorías accesibles según plan
    const allowedCategories: string[] = category_filter
      ? (category_filter).filter(c => (PLAN_CATEGORIES[plan] ?? []).includes(c))
      : PLAN_CATEGORIES[plan] ?? ['OFICIOS', 'REBT'];

    // 5. Embedding de la query (Voyage AI voyage-3-lite, input_type=query)
    const t0 = Date.now();
    const embedRes = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'voyage-3-lite', input: [query], input_type: 'query' }),
    });
    if (!embedRes.ok) throw new Error(`Voyage AI ${embedRes.status}: ${await embedRes.text()}`);
    const embedData = await embedRes.json();
    const queryEmbedding: number[] = embedData.data[0].embedding;

    // 6. Búsqueda híbrida (coseno 70% + trigrama 30%) — top 6 chunks
    const { data: chunks, error: searchErr } = await supabase.rpc('hybrid_search_norm_chunks', {
      query_embedding: queryEmbedding,
      query_text:      query,
      match_count:     6,
      category_filter: allowedCategories,
      oficio_filter:   oficio_filter ?? null,
    });
    if (searchErr) throw new Error(`Search: ${searchErr.message}`);

    // Filtrar chunks con score bajo y limitar a top 4 para contexto
    const topChunks: any[] = ((chunks as any[]) ?? [])
      .filter(c => c.hybrid_score > 0.20)
      .slice(0, 4);

    // 7. Construir contexto para el LLM
    const contextText = topChunks.length > 0
      ? topChunks.map((c, i) => [
          `[FRAGMENTO ${i + 1}]`,
          `Documento: ${c.category}${c.article_id ? ` — ${c.article_id}` : ''}`,
          c.article_title ? `Título: ${c.article_title}` : '',
          `Texto: ${c.chunk_text.slice(0, 1200)}`,
          '---',
        ].filter(Boolean).join('\n')).join('\n\n')
      : '(No se encontraron fragmentos relevantes para esta consulta)';

    // 8. Llamada a Claude Sonnet 4.6
    const userMessage = `NORMATIVA DISPONIBLE:\n${contextText}\n\nPREGUNTA DEL INSTALADOR:\n${query}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:       'claude-sonnet-4-6',
        max_tokens:  800,
        temperature: 0.1,
        system:      SYSTEM_PROMPT,
        messages:    [{ role: 'user', content: userMessage }],
      }),
    });
    if (!claudeRes.ok) throw new Error(`Claude ${claudeRes.status}: ${await claudeRes.text()}`);
    const claudeData = await claudeRes.json();
    const rawText: string = claudeData.content?.[0]?.text ?? '';

    // 9. Parsear respuesta JSON de Claude
    let parsed: { answer: string; sources: any[]; confidence: string };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] ?? rawText);
    } catch {
      parsed = { answer: rawText, sources: [], confidence: topChunks.length > 0 ? 'low' : 'none' };
    }

    // Enriquecer fuentes con datos de los chunks recuperados
    const enrichedSources = (parsed.sources ?? []).map((s: any) => {
      const match = topChunks.find(c =>
        c.article_id === s.article_id ||
        c.chunk_id?.includes(s.article_id) ||
        c.category === s.document
      );
      return {
        document:      s.document ?? match?.category ?? 'Normativa',
        article_id:    s.article_id ?? match?.article_id ?? null,
        article_title: s.article_title ?? match?.article_title ?? null,
        excerpt:       s.excerpt ?? '',
        boe_ref:       s.boe_ref ?? null,
      };
    });

    const confidence = parsed.confidence ?? (topChunks.length > 0 ? 'medium' : 'none');
    const latencyMs  = Date.now() - t0;

    // 10. Registrar en trade_rag_logs
    let queryLogId: string | null = null;
    if (userId || orgId) {
      const { data: logRow } = await supabase
        .from('trade_rag_logs')
        .insert({
          org_id:           orgId,
          user_id:          userId,
          query_text:       query,
          chunks_retrieved: topChunks.map(c => c.id),
          answer_text:      parsed.answer,
          sources_json:     enrichedSources,
          confidence,
          model_used:       'claude-sonnet-4-6',
          tokens_input:     claudeData.usage?.input_tokens ?? null,
          tokens_output:    claudeData.usage?.output_tokens ?? null,
          latency_ms:       latencyMs,
        })
        .select('id')
        .single();
      queryLogId = logRow?.id ?? null;
    }

    // 11. Incrementar contador de rate limit
    if (orgId) {
      await supabase.rpc('increment_rag_rate_limit', { p_org_id: orgId, p_date: today });
    }

    // 12. Responder
    return new Response(JSON.stringify({
      answer:      parsed.answer,
      sources:     enrichedSources,
      confidence,
      query_id:    queryLogId,
      chunks_used: topChunks.length,
      latency_ms:  latencyMs,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[trade-norm-query]', err?.message);
    return new Response(JSON.stringify({
      error:  'Error interno del Asistente Técnico',
      detail: err?.message,
    }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
