import { StyleSheet } from 'react-native';

export const COLORS = {
  primary: '#0F172A',      // Slate 900 (Azul marino muy oscuro)
  primaryLight: '#1E293B', // Slate 800
  secondary: '#2563EB',    // Blue 600 (Azul de marca)
  secondaryLight: '#DBEAFE', // Blue 100
  success: '#10B981',      // Emerald 500 (Verde éxito)
  successLight: '#D1FAE5', // Emerald 100
  warning: '#F59E0B',      // Amber 500
  danger: '#EF4444',       // Red 500
  background: '#F8FAFC',   // Slate 50 (Gris muy claro)
  card: '#FFFFFF',         // Blanco puro
  border: '#E2E8F0',       // Slate 200 (Gris de borre)
  textPrimary: '#0F172A',  // Slate 900
  textSecondary: '#64748B',// Slate 500 (Gris secundario)
  textLight: '#94A3B8',    // Slate 400
  white: '#FFFFFF',
};

export const TYPOGRAPHY = {
  h1: {
    fontSize: 26,
    fontWeight: 'bold' as const,
    color: COLORS.textPrimary,
  },
  h2: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  body: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  bodySecondary: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  caption: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    letterSpacing: 0.5,
  },
};

export const SHADOWS = {
  xs: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
};

export const COMMON_STYLES = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
});
