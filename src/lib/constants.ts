export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? '';

// Controla si el marketplace está disponible en esta build.
// En producción fase 1 y piloto mantener en false hasta activar también
// admin_automation_config.marketplace_phase_enabled = 'true' en la BD.
export const MARKETPLACE_ENABLED = import.meta.env.VITE_MARKETPLACE_ENABLED === 'true';
