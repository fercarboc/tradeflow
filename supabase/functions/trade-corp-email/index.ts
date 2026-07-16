import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_CRM_API_KEY') ?? Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const FROM = 'TrabFlow Technologies <contacto@trabflow.com>';
const LOGO_URL = 'https://www.trabflow.com/LOGO_TRABFLOW.png';

type AttachItem = string | { storage_path: string; bucket?: string; nombre?: string; mime_type?: string; id?: string };

function buildHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <tr><td style="background:#1e3a5f;padding:24px 32px;text-align:center">
        <img src="${LOGO_URL}" alt="TrabFlow" height="44" style="display:inline-block;height:44px">
        <p style="color:#93c5fd;font-size:10px;margin:8px 0 0;letter-spacing:2px;text-transform:uppercase">TrabFlow Technologies S.L.</p>
      </td></tr>
      <tr><td style="padding:32px;color:#1e293b;font-size:14px;line-height:1.7">
        ${bodyHtml}
      </td></tr>
      <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;border-radius:0 0 12px 12px">
        <p style="margin:0;font-size:13px;color:#1e3a5f;font-weight:700">Fernando Carbonell Cabo</p>
        <p style="margin:2px 0 10px;font-size:11px;color:#64748b">Fundador y CEO · TrabFlow Technologies S.L.</p>
        <p style="margin:1px 0;font-size:11px;color:#475569">📧 contacto@trabflow.com &nbsp;·&nbsp; 📞 672 336 572 &nbsp;·&nbsp; 🌐 www.trabflow.com</p>
        <p style="margin:1px 0;font-size:11px;color:#475569">Santander (Cantabria) · España</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0"/>
        <p style="margin:0;font-size:9px;color:#94a3b8">Este correo fue enviado por TrabFlow Technologies S.L. Si ha llegado por error, rogamos su eliminación.</p>
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const {
      to, cc, subject, body_text, body_html: body_html_raw,
      entity_id, template_id, template_nombre,
      attachment_paths = [],
    } = body as {
      to: string;
      cc?: string;
      subject: string;
      body_text: string;
      body_html?: string;
      entity_id?: string;
      template_id?: string;
      template_nombre?: string;
      attachment_paths?: AttachItem[];
    };

    if (!to || !subject || !body_text) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios: to, subject, body_text' }), { status: 400, headers: corsHeaders });
    }

    // Build HTML — prefer pre-built body_html, fallback to converting body_text
    const body_html = body_html_raw
      ? buildHtml(body_html_raw)
      : buildHtml(textToHtml(body_text));

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Download attachments from Storage
    const attachments: { filename: string; content: string }[] = [];
    const attachmentsMeta: AttachItem[] = [];

    for (const item of attachment_paths) {
      try {
        const storagePath = typeof item === 'string' ? item : item.storage_path;
        const bucket = typeof item === 'string' ? 'corporate-documents' : (item.bucket ?? 'corporate-documents');
        // Build filename: use nombre + extension from path (e.g. "01 Vision y Estrategia.docx")
        const ext = storagePath.includes('.') ? storagePath.split('.').pop() : '';
        const nombre = typeof item === 'string' ? null : item.nombre;
        const filename = nombre && ext && !nombre.includes('.')
          ? `${nombre}.${ext}`
          : (storagePath.split('/').pop() ?? storagePath);

        if (!storagePath || storagePath.startsWith('http')) continue;

        const { data, error } = await supabase.storage.from(bucket).download(storagePath);
        if (error || !data) {
          console.error(`[trade-corp-email] Storage download failed for ${storagePath}:`, error?.message);
          continue;
        }
        const buffer = await data.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        attachments.push({ filename, content: base64 });
        attachmentsMeta.push(item);
        console.log(`[trade-corp-email] Attached: ${filename} (${bytes.length} bytes)`);
      } catch (attachErr) {
        console.error(`[trade-corp-email] Attachment error:`, attachErr);
      }
    }

    const ccList = cc ? cc.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined;

    const resendPayload: Record<string, unknown> = {
      from: FROM,
      to: [to],
      cc: ccList,
      subject,
      html: body_html,
      text: body_text,
    };
    if (attachments.length > 0) {
      resendPayload.attachments = attachments;
    }

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

      if (entity_id) {
        await supabase.from('entity_email_history').insert({
          entity_id,
          template_id: template_id ?? null,
          template_nombre: template_nombre ?? null,
          to_email: to,
          cc_email: cc ?? null,
          subject,
          body_text,
          sent_at: new Date().toISOString(),
          status: 'error',
          error_message: errMsg,
          attachments: attachmentsMeta.length > 0 ? attachmentsMeta : null,
        });
      }

      return new Response(
        JSON.stringify({ error: `Resend ${resendRes.status}: ${JSON.stringify(resendBody)}` }),
        { status: 200, headers: corsHeaders },
      );
    }

    // Success — record in DB
    if (entity_id) {
      const { error: dbErr } = await supabase.from('entity_email_history').insert({
        entity_id,
        template_id: template_id ?? null,
        template_nombre: template_nombre ?? null,
        to_email: to,
        cc_email: cc ?? null,
        subject,
        body_text,
        sent_at: new Date().toISOString(),
        status: 'sent',
        provider_message_id: resendBody.id ?? null,
        attachments: attachmentsMeta.length > 0 ? attachmentsMeta : null,
      });
      if (dbErr) console.error('[trade-corp-email] DB insert error:', dbErr.message);
    }

    console.log(`[trade-corp-email] Sent to ${to}, id=${resendBody.id}, attachments=${attachments.length}`);
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
