import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const FROM = 'TrabFlow Technologies <contacto@trabflow.com>';

const LOGO_URL = 'https://www.trabflow.com/LOGO_TRABFLOW.png';

function buildHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <tr><td style="background:#1e293b;padding:24px 32px;text-align:center">
        <img src="${LOGO_URL}" alt="TrabFlow" height="36" style="display:inline-block;height:36px">
      </td></tr>
      <tr><td style="padding:32px;color:#1e293b;font-size:14px;line-height:1.6">
        ${bodyHtml}
      </td></tr>
      <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;color:#94a3b8;font-size:11px">
        <p style="margin:0">TrabFlow Technologies · Software de gestión para instaladores</p>
        <p style="margin:4px 0 0">Este correo fue enviado desde la plataforma TrabFlow. Si no esperaba recibirlo, puede ignorarlo.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px 0">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const {
      to, cc, subject, body_text,
      entity_id, template_id, template_nombre,
      attachment_paths = [],
    } = body as {
      to: string;
      cc?: string;
      subject: string;
      body_text: string;
      entity_id?: string;
      template_id?: string;
      template_nombre?: string;
      attachment_paths?: string[];
    };

    if (!to || !subject || !body_text) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios: to, subject, body_text' }), { status: 400, headers: corsHeaders });
    }

    // Build HTML body
    const body_html = buildHtml(textToHtml(body_text));

    // Download attachments from Storage
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const attachments: { filename: string; content: string }[] = [];
    for (const storagePath of attachment_paths) {
      try {
        if (!storagePath || storagePath.startsWith('http')) continue;
        const { data, error } = await supabase.storage
          .from('corporate-documents')
          .download(storagePath);
        if (error || !data) {
          console.error(`[trade-corp-email] Storage download failed for ${storagePath}:`, error?.message);
          continue;
        }
        const buffer = await data.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const filename = storagePath.split('/').pop() ?? storagePath;
        attachments.push({ filename, content: base64 });
      } catch (attachErr) {
        console.error(`[trade-corp-email] Attachment error for ${storagePath}:`, attachErr);
        // skip this attachment, don't fail the whole send
      }
    }

    // Build Resend payload
    const toList = [to, ...(cc ? cc.split(',').map((s: string) => s.trim()).filter(Boolean) : [])];
    const resendPayload: Record<string, unknown> = {
      from: FROM,
      to: [to],
      cc: cc ? cc.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
      subject,
      html: body_html,
      text: body_text,
    };
    if (attachments.length > 0) {
      resendPayload.attachments = attachments;
    }

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    const resendBody = await resendRes.json();

    if (!resendRes.ok) {
      const errMsg = resendBody?.message ?? resendBody?.error ?? `Resend ${resendRes.status}`;
      console.error('[trade-corp-email] Resend error:', resendRes.status, errMsg);

      // Record failed attempt
      if (entity_id) {
        await supabase.from('entity_email_history').insert({
          entity_id,
          template_id: template_id ?? null,
          template_nombre: template_nombre ?? null,
          to_email: to,
          cc: cc ?? null,
          subject,
          sent_at: new Date().toISOString(),
          status: 'error',
          attachment_paths: attachment_paths.length > 0 ? attachment_paths : null,
        }).then(() => {});
      }

      return new Response(
        JSON.stringify({ error: `Resend ${resendRes.status}: ${JSON.stringify(resendBody)}` }),
        { status: 200, headers: corsHeaders }, // return 200 so frontend gets the error message
      );
    }

    // Record success
    if (entity_id) {
      await supabase.from('entity_email_history').insert({
        entity_id,
        template_id: template_id ?? null,
        template_nombre: template_nombre ?? null,
        to_email: to,
        cc: cc ?? null,
        subject,
        sent_at: new Date().toISOString(),
        status: 'sent',
        attachment_paths: attachment_paths.length > 0 ? attachment_paths : null,
      }).then(() => {});
    }

    console.log(`[trade-corp-email] Sent to ${toList.join(', ')}, id=${resendBody.id}`);
    return new Response(
      JSON.stringify({ success: true, id: resendBody.id, attachments_sent: attachments.length }),
      { status: 200, headers: corsHeaders },
    );

  } catch (err) {
    console.error('[trade-corp-email] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Error interno' }),
      { status: 500, headers: corsHeaders },
    );
  }
});
