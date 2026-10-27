/**
 * CORS tests for geocode and route Edge Functions.
 *
 * These tests verify CORS behavior via HTTP requests to the deployed EF
 * (OPTIONS preflight) and verify the corsHeaders constant shape via
 * structural assertions on the source files.
 *
 * Tests that require a real JWT (200 success, 400/403/429) are integration
 * tests left for manual smoke testing; only no-auth paths are automated here.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const EF_DIR = path.resolve(__dirname, '../../../supabase/functions');

function readEfSource(slug: string): string {
  return fs.readFileSync(path.join(EF_DIR, slug, 'index.ts'), 'utf-8');
}

// ── Structural tests: verify CORS headers are correctly defined ───────────────

describe('CORS headers — geocode', () => {
  const src = readEfSource('geocode');

  it('defines CORS_HEADERS with Access-Control-Allow-Origin: *', () => {
    expect(src).toContain("'Access-Control-Allow-Origin':  '*'");
  });

  it('includes x-client-info in Access-Control-Allow-Headers', () => {
    expect(src).toContain('x-client-info');
  });

  it('includes apikey in Access-Control-Allow-Headers', () => {
    expect(src).toContain('apikey');
  });

  it('includes Access-Control-Allow-Methods with POST and OPTIONS', () => {
    expect(src).toContain('POST, OPTIONS');
  });

  it('OPTIONS handler uses CORS_HEADERS (not inline object)', () => {
    expect(src).toContain('headers: CORS_HEADERS');
  });

  it('has no bare Response.json calls (all replaced by jsonRes)', () => {
    // After Deno.serve starts, no raw Response.json should remain
    const afterServe = src.split('Deno.serve')[1] ?? '';
    expect(afterServe).not.toContain('Response.json(');
  });
});

describe('CORS headers — route', () => {
  const src = readEfSource('route');

  it('defines CORS_HEADERS with Access-Control-Allow-Origin: *', () => {
    expect(src).toContain("'Access-Control-Allow-Origin':  '*'");
  });

  it('includes x-client-info in Access-Control-Allow-Headers', () => {
    expect(src).toContain('x-client-info');
  });

  it('includes apikey in Access-Control-Allow-Headers', () => {
    expect(src).toContain('apikey');
  });

  it('includes Access-Control-Allow-Methods with POST and OPTIONS', () => {
    expect(src).toContain('POST, OPTIONS');
  });

  it('OPTIONS handler uses CORS_HEADERS (not inline object)', () => {
    expect(src).toContain('headers: CORS_HEADERS');
  });

  it('has no bare Response.json calls (all replaced by jsonRes)', () => {
    const afterServe = src.split('Deno.serve')[1] ?? '';
    expect(afterServe).not.toContain('Response.json(');
  });
});

// ── Live preflight tests: OPTIONS to deployed EF ─────────────────────────────
// These tests require network access. They skip gracefully if offline.

const SUPABASE_URL = 'https://dqqjaujnulutinskmqsu.supabase.co';

describe('CORS preflight — geocode (live)', () => {
  it('OPTIONS returns Access-Control-Allow-Origin: *', async () => {
    let res: Response;
    try {
      res = await fetch(`${SUPABASE_URL}/functions/v1/geocode`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://www.trabflow.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    } catch {
      // offline — skip
      return;
    }
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  // Verify after redeploying geocode EF with CORS fix
  it.todo('OPTIONS allows x-client-info header — requires redeploy');
  it.todo('OPTIONS allows POST in Access-Control-Allow-Methods — requires redeploy');
});

describe('CORS preflight — route (live)', () => {
  it('OPTIONS returns Access-Control-Allow-Origin: *', async () => {
    let res: Response;
    try {
      res = await fetch(`${SUPABASE_URL}/functions/v1/route`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://www.trabflow.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    } catch {
      return;
    }
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  // Verify after redeploying route EF with CORS fix
  it.todo('OPTIONS allows x-client-info header — requires redeploy');
});
