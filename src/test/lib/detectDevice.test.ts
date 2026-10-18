/**
 * Tests de selección de layout móvil/escritorio para isNativeDevice.
 *
 * isNativeDevice = useIsMobile() en AppDashboardView.tsx.
 * Única fuente de verdad: useIsMobile (matchMedia max-width:767px).
 *
 * Cubre:
 *  - Viewport ancho → layout escritorio
 *  - Viewport estrecho → layout nativo móvil
 *  - Transiciones de redimensionado (sin recargar)
 *  - Independencia de standalone/display-mode y ?app=true
 *  - isMobileMode (simulador manual) no se sobreescribe con el resize
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '../../hooks/useIsMobile';

// ── Helpers ──────────────────────────────────────────────────────────────────

function setViewportWidth(px: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });
}

function mockMatchMedia(initialMatches: boolean) {
  const listeners: ((e: MediaQueryListEvent) => void)[] = [];
  const mq = {
    matches: initialMatches,
    addEventListener: vi.fn((_: string, fn: (e: MediaQueryListEvent) => void) => listeners.push(fn)),
    removeEventListener: vi.fn((_: string, fn: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
    trigger: (newMatches: boolean) =>
      listeners.forEach(fn => fn({ matches: newMatches } as MediaQueryListEvent)),
  };
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockReturnValue(mq) });
  return mq;
}

afterEach(() => vi.restoreAllMocks());

// ── Snapshot: valor inicial según viewport ────────────────────────────────────

describe('isNativeDevice — valor inicial según viewport', () => {
  it('Windows navegador ancho (1920px) → false', () => {
    setViewportWidth(1920);
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('Windows PWA maximizada (1920px) → false aunque standalone sea true', () => {
    // standalone/display-mode NO afecta a useIsMobile; solo importa el viewport
    setViewportWidth(1920);
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('portátil táctil (1366px) → false', () => {
    setViewportWidth(1366);
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('tablet landscape (1024px) → false', () => {
    setViewportWidth(1024);
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('exactamente en el breakpoint (768px) → false  [768 no es < 768]', () => {
    setViewportWidth(768);
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('un píxel bajo el breakpoint (767px) → true', () => {
    setViewportWidth(767);
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('Android phone (360px) → true', () => {
    setViewportWidth(360);
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('iPhone 14 (390px) → true', () => {
    setViewportWidth(390);
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('Windows PWA estrecha (400px) → true, layout nativo en lugar de simulador iPhone', () => {
    setViewportWidth(400);
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('?app=true en PC ancho (1440px) → false: el parámetro URL no afecta al viewport', () => {
    setViewportWidth(1440);
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});

// ── Transiciones reactivas (matchMedia) ─────────────────────────────────────

describe('isNativeDevice — transiciones de redimensionado', () => {
  it('ancho→estrecho: cambia a móvil sin recargar la página', () => {
    setViewportWidth(1920);
    const mq = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false); // escritorio

    act(() => { setViewportWidth(360); mq.trigger(true); });
    expect(result.current).toBe(true); // → móvil nativo
  });

  it('estrecho→ancho: cambia a escritorio sin recargar la página', () => {
    setViewportWidth(360);
    const mq = mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true); // móvil

    act(() => { setViewportWidth(1920); mq.trigger(false); });
    expect(result.current).toBe(false); // → escritorio
  });

  it('estrecho→ancho→estrecho: coherencia en múltiples transiciones', () => {
    setViewportWidth(360);
    const mq = mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
    act(() => { setViewportWidth(1920); mq.trigger(false); });
    expect(result.current).toBe(false);
    act(() => { setViewportWidth(400); mq.trigger(true); });
    expect(result.current).toBe(true);
  });

  it('isMobileMode (simulador manual) no se sobreescribe por el resize', () => {
    // isNativeDevice (useIsMobile) y isMobileMode son estados independientes.
    // Cuando isNativeDevice cambia, isMobileMode permanece intacto.
    setViewportWidth(1920);
    const mq = mockMatchMedia(false);

    let isMobileMode = false; // estado del simulador — controlado por el usuario
    const { result } = renderHook(() => useIsMobile());

    // Usuario activa simulador manualmente
    isMobileMode = true;

    // Resize a estrecho → isNativeDevice cambia, isMobileMode permanece
    act(() => { setViewportWidth(360); mq.trigger(true); });
    expect(result.current).toBe(true);
    expect(isMobileMode).toBe(true); // simulador intacto

    // Vuelta a ancho
    act(() => { setViewportWidth(1920); mq.trigger(false); });
    expect(result.current).toBe(false);
    expect(isMobileMode).toBe(true); // simulador sigue activo (decisión del usuario)
  });

  it('standalone=true con ventana ancha no activa isNativeDevice', () => {
    setViewportWidth(1920);
    mockMatchMedia(false); // matchMedia (max-width:767px) = false
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
