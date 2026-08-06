// TrabFlow Design System v1 — token constants
// Importar estos strings en cualquier componente nuevo para
// garantizar consistencia visual sin memorizar clases de Tailwind.

// ─── Colores de marca ─────────────────────────────────────────────────────────

export const DS = {
  // ── Botones ──────────────────────────────────────────────────────────────────
  btn: {
    primary:   'rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
    secondary: 'rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
    danger:    'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500',
    ghost:     'rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
    pill:      'rounded-full px-3 py-1 text-xs font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
  },

  // ── Inputs ───────────────────────────────────────────────────────────────────
  input: {
    base:   'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500',
    error:  'w-full rounded-lg border border-red-400 dark:border-red-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500',
    search: 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500',
  },

  // ── Cards ────────────────────────────────────────────────────────────────────
  card: {
    base:    'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
    urgent:  'rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900',
    success: 'rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10',
  },

  // ── KPI Cards ────────────────────────────────────────────────────────────────
  kpi: {
    wrapper: 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4',
    label:   'text-xs text-slate-500 mb-1',
    value:   'text-2xl font-bold tabular-nums',
    sub:     'text-xs text-slate-400 mt-0.5',
  },

  // ── Badges ───────────────────────────────────────────────────────────────────
  badge: {
    pending:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    preparing: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    shipped:   'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    delivered: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    base:      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  },

  // ── Alertas ──────────────────────────────────────────────────────────────────
  alert: {
    error:   'rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-3',
    warning: 'rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 px-4 py-3',
    success: 'rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-3',
    info:    'rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 px-4 py-3',
  },

  // ── Loaders ──────────────────────────────────────────────────────────────────
  spinner: {
    sm: 'h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent',
    md: 'h-6 w-6 motion-safe:animate-spin rounded-full border-2 border-teal-500 border-t-transparent',
    lg: 'h-8 w-8 motion-safe:animate-spin rounded-full border-2 border-teal-400 border-t-transparent',
  },

  // ── Skeletons ────────────────────────────────────────────────────────────────
  skeleton: {
    line:  'h-4 rounded bg-slate-200 dark:bg-slate-800 motion-safe:animate-pulse',
    block: 'rounded-xl bg-slate-200 dark:bg-slate-800 motion-safe:animate-pulse',
  },

  // ── Empty states ─────────────────────────────────────────────────────────────
  empty: {
    wrapper: 'flex flex-col items-center justify-center gap-2 py-16 text-center',
    text:    'text-sm text-slate-400',
  },

  // ── Tipografía ───────────────────────────────────────────────────────────────
  text: {
    heading:  'text-xl font-bold text-slate-900 dark:text-slate-100',
    subhead:  'text-base font-semibold text-slate-900 dark:text-slate-100',
    body:     'text-sm text-slate-700 dark:text-slate-300',
    caption:  'text-xs text-slate-400',
    label:    'text-xs font-medium text-slate-600 dark:text-slate-400',
    mono:     'font-mono text-sm text-slate-500',
  },

  // ── Divisores ────────────────────────────────────────────────────────────────
  divider: 'border-t border-slate-100 dark:border-slate-800',

  // ── Focus global ─────────────────────────────────────────────────────────────
  focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
} as const;

// ─── Paleta de colores (referencia) ──────────────────────────────────────────
// Primario:   teal-600   (#0d9488)   hover: teal-500 (#14b8a6)
// Fondo luz:  slate-50   (#f8fafc)   / white (#ffffff) para cards
// Fondo dark: slate-950  (#020617)   / slate-900 (#0f172a) para cards
// Borde luz:  slate-200  (#e2e8f0)
// Borde dark: slate-800  (#1e293b)
// Texto:      slate-900  (#0f172a)
// Texto seco: slate-500  (#64748b)
// Alerta:     amber-600  (#d97706)
// Error:      red-600    (#dc2626)
// Éxito:      emerald-600 (#059669)
//
// ─── Tipografía ──────────────────────────────────────────────────────────────
// Display: Space Grotesk (headings)
// Body:    Inter (texto corrido, UI)
// Mono:    JetBrains Mono (refs, códigos)
//
// ─── Espaciado ───────────────────────────────────────────────────────────────
// XS:  4px   (gap-1, p-1)
// SM:  8px   (gap-2, p-2)
// MD:  12px  (gap-3, p-3)
// LG:  16px  (gap-4, p-4)
// XL:  24px  (gap-6, p-6)
//
// ─── Elevaciones ─────────────────────────────────────────────────────────────
// Nivel 0:  no shadow (contenido plano)
// Nivel 1:  shadow-sm (cards estándar)
// Nivel 2:  shadow-xl (modales, drawers)
// Nivel 3:  shadow-2xl (toasts, overlays)
//
// ─── Radios ──────────────────────────────────────────────────────────────────
// Pills/badges: rounded-full
// Inputs/chips: rounded-lg
// Cards:        rounded-xl
// Modales:      rounded-2xl
