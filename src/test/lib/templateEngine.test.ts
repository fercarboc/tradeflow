/**
 * Tests — templateEngine: resolveTemplate, buildTemplateVars, ensureAcceptanceUrl,
 * canonical template contract, and onboarding seed alignment.
 *
 * To run:  npx vitest run src/test/lib/templateEngine.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  resolveTemplate,
  buildTemplateVars,
  ensureAcceptanceUrl,
  DEFAULT_TEMPLATES,
} from '../../lib/templateEngine';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACCEPTANCE_URL = 'https://trabflow.com/p/test-token-abc123';

const BASE_VARS = buildTemplateVars({
  empresa:      { nombre: 'Fontanería Ruiz SL', telefono: '600 111 222', email: 'info@ruiz.es', nif: 'B12345678' },
  cliente:      { nombre: 'Ana López', telefono: '911 234 567' },
  presupuesto:  { numero: 'PRE-2026-042', fecha: '01/09/2026', total: 1200, iva: 21 },
  enlaceAceptacion: ACCEPTANCE_URL,
});

// ── resolveTemplate: double-brace format ─────────────────────────────────────

describe('resolveTemplate — double-brace format', () => {
  it('interpolates {{nombre_cliente}}', () => {
    const msg = resolveTemplate('Hola {{nombre_cliente}}', BASE_VARS);
    expect(msg).toBe('Hola Ana López');
  });

  it('interpolates {{numero_presupuesto}}', () => {
    const msg = resolveTemplate('Presupuesto nº {{numero_presupuesto}}', BASE_VARS);
    expect(msg).toBe('Presupuesto nº PRE-2026-042');
  });

  it('interpolates {{nombre_empresa}}', () => {
    const msg = resolveTemplate('De: {{nombre_empresa}}', BASE_VARS);
    expect(msg).toBe('De: Fontanería Ruiz SL');
  });

  it('interpolates {{total}} with IVA included and formatted', () => {
    const msg = resolveTemplate('Total: {{total}}', BASE_VARS);
    // 1200 * 1.21 = 1452.00 — locale formatting varies (browser: '1.452,00 €', Node: '1452,00 €')
    expect(msg).toMatch(/1[\s.]?452/);
    expect(msg).toContain('€');
  });

  it('interpolates {{enlace_aceptacion}}', () => {
    const msg = resolveTemplate('Para aceptarlo: {{enlace_aceptacion}}', BASE_VARS);
    expect(msg).toBe(`Para aceptarlo: ${ACCEPTANCE_URL}`);
  });

  it('resolves {{#if}} block when variable is present', () => {
    const vars = buildTemplateVars({
      ia: { resumen: 'Cambio de caldera Baxi' },
    });
    const tpl = '{{#if resumen_trabajo_ia}}Resumen: {{resumen_trabajo_ia}}{{/if}}';
    expect(resolveTemplate(tpl, vars)).toBe('Resumen: Cambio de caldera Baxi');
  });

  it('removes {{#if}} block when variable is absent', () => {
    const tpl = '{{#if resumen_trabajo_ia}}Resumen: {{resumen_trabajo_ia}}{{/if}}';
    expect(resolveTemplate(tpl, BASE_VARS)).toBe('');
  });

  it('replaces unknown variable with empty string', () => {
    const msg = resolveTemplate('X={{variable_inexistente}}', BASE_VARS);
    expect(msg).toBe('X=');
  });
});

// ── resolveTemplate: legacy single-brace format (the broken seed) ────────────

describe('resolveTemplate — legacy single-brace format (no substitution)', () => {
  const LEGACY_TEMPLATE =
    'Hola {nombre},\n\nAdjunto el presupuesto {numero} por importe de {total}€.\n\nSaludos,\n{empresa}';

  it('does NOT substitute {nombre} — confirms engine incompatibility', () => {
    const msg = resolveTemplate(LEGACY_TEMPLATE, BASE_VARS);
    expect(msg).toContain('{nombre}');
    expect(msg).not.toContain('Ana López');
  });

  it('does NOT substitute {numero}', () => {
    const msg = resolveTemplate(LEGACY_TEMPLATE, BASE_VARS);
    expect(msg).toContain('{numero}');
    expect(msg).not.toContain('PRE-2026-042');
  });

  it('does NOT substitute {empresa}', () => {
    const msg = resolveTemplate(LEGACY_TEMPLATE, BASE_VARS);
    expect(msg).toContain('{empresa}');
    expect(msg).not.toContain('Fontanería Ruiz SL');
  });

  it('does NOT contain the acceptance URL (demonstrates the loss)', () => {
    const msg = resolveTemplate(LEGACY_TEMPLATE, BASE_VARS);
    expect(msg).not.toContain(ACCEPTANCE_URL);
  });
});

// ── ensureAcceptanceUrl ───────────────────────────────────────────────────────

describe('ensureAcceptanceUrl', () => {
  it('appends URL when message does not contain it', () => {
    const msg = 'Hola Ana, aquí tu presupuesto.';
    const result = ensureAcceptanceUrl(msg, ACCEPTANCE_URL);
    expect(result).toContain(ACCEPTANCE_URL);
    expect(result).toContain('✅');
  });

  it('does NOT duplicate URL when already present in message', () => {
    const msg = `Para aceptarlo: ${ACCEPTANCE_URL}`;
    const result = ensureAcceptanceUrl(msg, ACCEPTANCE_URL);
    const count = (result.match(new RegExp(ACCEPTANCE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
    expect(count).toBe(1);
  });

  it('acceptance URL appears exactly once in legacy template output', () => {
    const LEGACY = 'Hola {nombre}, presupuesto {numero}.';
    const resolved = resolveTemplate(LEGACY, BASE_VARS);
    const withUrl = ensureAcceptanceUrl(resolved, ACCEPTANCE_URL);
    const count = (withUrl.match(new RegExp(ACCEPTANCE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
    expect(count).toBe(1);
  });

  it('returns message unchanged when acceptanceUrl is undefined', () => {
    const msg = 'Hola Ana.';
    expect(ensureAcceptanceUrl(msg, undefined)).toBe('Hola Ana.');
  });

  it('returns message unchanged when acceptanceUrl is empty string', () => {
    const msg = 'Hola Ana.';
    expect(ensureAcceptanceUrl(msg, '')).toBe('Hola Ana.');
  });

  it('guarantees URL even for custom template without {{enlace_aceptacion}}', () => {
    const customTemplate = 'Hola {{nombre_cliente}}, presupuesto {{numero_presupuesto}} listo.';
    const resolved = resolveTemplate(customTemplate, BASE_VARS);
    expect(resolved).not.toContain(ACCEPTANCE_URL);
    const withUrl = ensureAcceptanceUrl(resolved, ACCEPTANCE_URL);
    expect(withUrl).toContain(ACCEPTANCE_URL);
  });
});

// ── Canonical template contract ───────────────────────────────────────────────

describe('DEFAULT_TEMPLATES.whatsapp_presupuesto — canonical contract', () => {
  const tpl = DEFAULT_TEMPLATES.whatsapp_presupuesto;

  it('uses double-brace {{variable}} format', () => {
    expect(tpl).toMatch(/\{\{[\w_]+\}\}/);
  });

  it('contains {{nombre_cliente}}', () => {
    expect(tpl).toContain('{{nombre_cliente}}');
  });

  it('contains {{numero_presupuesto}}', () => {
    expect(tpl).toContain('{{numero_presupuesto}}');
  });

  it('contains {{nombre_empresa}}', () => {
    expect(tpl).toContain('{{nombre_empresa}}');
  });

  it('contains {{total}}', () => {
    expect(tpl).toContain('{{total}}');
  });

  it('contains {{enlace_aceptacion}}', () => {
    expect(tpl).toContain('{{enlace_aceptacion}}');
  });

  it('does NOT contain legacy single-brace placeholders', () => {
    // Negative lookbehind/lookahead ensures we only match {var} NOT inside {{var}}
    expect(tpl).not.toMatch(/(?<!\{)\{(nombre|numero|total|empresa)\}(?!\})/);
  });

  it('does NOT reference {{enlace_pdf}} (no PDF URL exists in current flow)', () => {
    expect(tpl).not.toContain('{{enlace_pdf}}');
  });

  it('contains {{telefono_empresa}} — correct key, not {{telefono}}', () => {
    expect(tpl).toContain('{{telefono_empresa}}');
    expect(tpl).not.toMatch(/\{\{telefono\}\}/);
  });

  it('resolves fully with base vars — no unresolved {{placeholders}}', () => {
    const resolved = resolveTemplate(tpl, BASE_VARS);
    expect(resolved).not.toMatch(/\{\{[\w_]+\}\}/);
  });

  it('resolved message contains client name', () => {
    const resolved = resolveTemplate(tpl, BASE_VARS);
    expect(resolved).toContain('Ana López');
  });

  it('resolved message contains acceptance URL', () => {
    const resolved = resolveTemplate(tpl, BASE_VARS);
    expect(resolved).toContain(ACCEPTANCE_URL);
  });
});

// ── buildTemplateVars — key contract ─────────────────────────────────────────

describe('buildTemplateVars — key contract', () => {
  it('produces telefono_empresa — not telefono — for company phone', () => {
    const vars = buildTemplateVars({ empresa: { telefono: '600 111 222' } });
    expect(vars).toHaveProperty('telefono_empresa', '600 111 222');
    expect(vars).not.toHaveProperty('telefono');
  });

  it('produces nombre_cliente for client name', () => {
    const vars = buildTemplateVars({ cliente: { nombre: 'Pedro' } });
    expect(vars).toHaveProperty('nombre_cliente', 'Pedro');
  });

  it('enlace_aceptacion is set only when enlaceAceptacion param is truthy', () => {
    const withUrl  = buildTemplateVars({ enlaceAceptacion: 'https://example.com/p/token' });
    const withoutUrl = buildTemplateVars({});
    expect(withUrl).toHaveProperty('enlace_aceptacion');
    expect(withoutUrl).not.toHaveProperty('enlace_aceptacion');
  });

  it('enlace_pdf is NOT set when enlacePdf is absent', () => {
    const vars = buildTemplateVars({});
    expect(vars).not.toHaveProperty('enlace_pdf');
  });
});

// ── Onboarding canonical alignment ───────────────────────────────────────────

describe('OnboardingWizard canonical alignment', () => {
  it('canonical template must contain all minimum required variables', () => {
    const required = [
      '{{nombre_cliente}}',
      '{{numero_presupuesto}}',
      '{{nombre_empresa}}',
      '{{total}}',
      '{{enlace_aceptacion}}',
    ];
    for (const v of required) {
      expect(DEFAULT_TEMPLATES.whatsapp_presupuesto).toContain(v);
    }
  });
});

// ── Acceptance URL exactly-once guarantee ─────────────────────────────────────

describe('Acceptance URL appears exactly once — both scenarios', () => {
  const VARS_WITH_URL = {
    ...BASE_VARS,
    enlace_aceptacion: ACCEPTANCE_URL,
  };

  it('Scenario A — canonical template: URL is in resolved message exactly once', () => {
    const resolved = resolveTemplate(DEFAULT_TEMPLATES.whatsapp_presupuesto, VARS_WITH_URL);
    const guarded  = ensureAcceptanceUrl(resolved, ACCEPTANCE_URL);
    const count    = (guarded.split(ACCEPTANCE_URL).length - 1);
    expect(count).toBe(1);
  });

  it('Scenario B — legacy/custom template without {{enlace_aceptacion}}: ensureAcceptanceUrl appends exactly once', () => {
    const legacyTemplate = 'Hola {nombre},\n\nTe envío el presupuesto. Importe: {total}.\n\nGracias.';
    const resolved = resolveTemplate(legacyTemplate, VARS_WITH_URL);
    expect(resolved).not.toContain(ACCEPTANCE_URL);
    const guarded = ensureAcceptanceUrl(resolved, ACCEPTANCE_URL);
    const count   = (guarded.split(ACCEPTANCE_URL).length - 1);
    expect(count).toBe(1);
  });

  it('Scenario B — calling ensureAcceptanceUrl twice does not duplicate the URL', () => {
    const legacyTemplate = 'Hola, tu presupuesto está listo.';
    const resolved  = resolveTemplate(legacyTemplate, {});
    const once      = ensureAcceptanceUrl(resolved, ACCEPTANCE_URL);
    const twice     = ensureAcceptanceUrl(once, ACCEPTANCE_URL);
    const count     = (twice.split(ACCEPTANCE_URL).length - 1);
    expect(count).toBe(1);
  });
});
