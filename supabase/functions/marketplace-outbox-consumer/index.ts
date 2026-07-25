/**
 * Sprint 1D — Marketplace Outbox Consumer
 *
 * Procesa eventos pendientes de trade_marketplace_outbox y envía push notifications.
 * Invocado por pg_cron cada minuto O directamente tras checkout.
 *
 * Eventos soportados:
 *   order.created      → push al proveedor (actor members)
 *   order.confirmed    → push al instalador (org members)
 *   order.preparing    → push al instalador
 *   order.shipped      → push al instalador (con tracking)
 *   order.delivered    → push al proveedor
 *   order.cancelled    → push a ambos
 *   job.unblocked      → push al instalador
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')             ?? '';
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_SUBJECT  = Deno.env.get('VAPID_SUBJECT')             ?? 'mailto:hola@trabflow.com';
const VAPID_PUBLIC   = Deno.env.get('VAPID_PUBLIC_KEY')          ?? '';
const VAPID_PRIVATE  = Deno.env.get('VAPID_PRIVATE_KEY')         ?? '';
const BATCH_SIZE     = 50; // eventos por ejecución
const MAX_RETRIES    = 3;

let vapidReady = false;
try {
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidReady = true;
  } else {
    console.warn('[outbox] VAPID keys not configured — push notifications disabled');
  }
} catch (e) {
  console.error('[outbox] VAPID init failed:', e);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface OutboxEvent {
  id:           string;
  actor_id:     string | null;
  org_id:       string | null;
  event_type:   string;
  payload:      Record<string, unknown>;
  retry_count:  number;
  created_at:   string;
}

interface PushSub {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sendPushToOrg(orgId: string, title: string, body: string, url = '/') {
  const { data: subs } = await db
    .from('trade_push_subscriptions')
    .select('subscription')
    .eq('org_id', orgId);

  if (!subs?.length) return 0;
  return sendPushBatch(subs as PushSub[], title, body, url);
}

async function sendPushToActor(actorId: string, title: string, body: string, url = '/') {
  const { data: members } = await db
    .from('trade_marketplace_actor_members')
    .select('user_id')
    .eq('actor_id', actorId)
    .eq('activo', true);

  if (!members?.length) return 0;

  const userIds = members.map((m: { user_id: string }) => m.user_id);
  const { data: subs } = await db
    .from('trade_push_subscriptions')
    .select('subscription')
    .in('user_id', userIds);

  if (!subs?.length) return 0;
  return sendPushBatch(subs as PushSub[], title, body, url);
}

async function sendPushBatch(subs: PushSub[], title: string, body: string, url: string): Promise<number> {
  if (!vapidReady) {
    console.warn('[outbox] Skipping push (VAPID not initialized)');
    return 0;
  }
  const payload = JSON.stringify({ title, body, url });
  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(s.subscription, payload))
  );

  // Eliminar suscripciones caducadas
  const expired = results
    .map((r, i) => ({ r, sub: subs[i] }))
    .filter(({ r }) => {
      if (r.status === 'rejected') {
        const status = (r.reason as { statusCode?: number })?.statusCode;
        return status === 410 || status === 404;
      }
      return false;
    })
    .map(({ sub }) => sub.subscription.endpoint);

  if (expired.length) {
    await db.from('trade_push_subscriptions').delete().in('endpoint', expired);
  }

  return results.filter((r) => r.status === 'fulfilled').length;
}

// ─── Procesadores por tipo de evento ─────────────────────────────────────────

async function processEvent(event: OutboxEvent): Promise<void> {
  const p = event.payload;
  const orderId = p.order_id as string | undefined;

  switch (event.event_type) {

    case 'order.created':
    case 'order_received': {
      // Proveedor recibe nuevo pedido
      if (event.actor_id) {
        await sendPushToActor(
          event.actor_id,
          '📦 Nuevo pedido recibido',
          `Tienes un nuevo pedido en TrabFlow Marketplace.`,
          '/proveedor'
        );
      }
      break;
    }

    case 'order.confirmed': {
      // Instalador: su pedido fue confirmado
      if (event.org_id) {
        await sendPushToOrg(
          event.org_id,
          '✅ Pedido confirmado',
          `Un proveedor ha confirmado tu pedido. Está en preparación.`,
          '/marketplace/seguimiento'
        );
      }
      break;
    }

    case 'order.preparing': {
      if (event.org_id) {
        await sendPushToOrg(
          event.org_id,
          '🔧 Pedido en preparación',
          `Tu material está siendo preparado para el envío.`,
          '/marketplace/seguimiento'
        );
      }
      break;
    }

    case 'order.shipped': {
      // Instalador: material enviado
      const trackingRef = p.tracking_ref as string | undefined;
      if (event.org_id) {
        await sendPushToOrg(
          event.org_id,
          '🚚 Material en camino',
          trackingRef
            ? `Tu pedido ha sido enviado. Ref: ${trackingRef}`
            : `Tu pedido está en tránsito. ¡Ya casi está!`,
          '/marketplace/seguimiento'
        );
      }
      break;
    }

    case 'order.delivered': {
      // Proveedor: instalador confirmó recepción
      if (event.actor_id) {
        await sendPushToActor(
          event.actor_id,
          '✅ Entrega confirmada',
          `El instalador ha confirmado la recepción del pedido.`,
          '/proveedor'
        );
      }
      break;
    }

    case 'order.cancelled': {
      const cancelledBy = p.cancelled_by as string | undefined;
      const isBySupplier = cancelledBy === 'supplier';
      if (event.org_id && isBySupplier) {
        await sendPushToOrg(
          event.org_id,
          '❌ Pedido cancelado',
          `Un proveedor ha cancelado uno de tus pedidos. Comprueba los detalles.`,
          '/marketplace/seguimiento'
        );
      } else if (event.actor_id && !isBySupplier) {
        await sendPushToActor(
          event.actor_id,
          '❌ Pedido cancelado',
          `Un instalador ha cancelado un pedido.`,
          '/proveedor'
        );
      }
      break;
    }

    case 'job.unblocked': {
      // Instalador: trabajo desbloqueado por llegada de materiales
      if (event.org_id) {
        await sendPushToOrg(
          event.org_id,
          '🔓 Trabajo desbloqueado',
          `Todo el material ha llegado. El trabajo se ha desbloqueado automáticamente.`,
          '/'
        );
      }
      break;
    }

    default:
      // Evento desconocido — marcar como procesado para no bloquear
      break;
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const start = Date.now();
  let processed = 0;
  let errors = 0;

  // Leer batch de eventos pendientes (con lock para evitar doble procesado)
  const { data: events, error: fetchError } = await db
    .from('trade_marketplace_outbox')
    .select('*')
    .is('processed_at', null)
    .lt('retry_count', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: fetchError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!events?.length) {
    return new Response(
      JSON.stringify({ processed: 0, elapsed_ms: Date.now() - start }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Pre-marcar todos como procesando (prevenir re-procesado concurrent)
  const eventIds = events.map((e: OutboxEvent) => e.id);
  await db.from('trade_marketplace_outbox')
    .update({ processed_at: new Date().toISOString() })
    .in('id', eventIds)
    .is('processed_at', null);

  // Procesar cada evento
  for (const event of events as OutboxEvent[]) {
    try {
      await processEvent(event);
      processed++;
    } catch (err) {
      errors++;
      // Si falla, des-marcar processed_at y aumentar retry_count
      await db.from('trade_marketplace_outbox')
        .update({
          processed_at: null,
          retry_count: (event.retry_count ?? 0) + 1,
          error: err instanceof Error ? err.message : String(err),
        })
        .eq('id', event.id);
    }
  }

  return new Response(
    JSON.stringify({
      processed,
      errors,
      elapsed_ms: Date.now() - start,
      batch_size: events.length,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
