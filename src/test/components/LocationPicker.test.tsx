/**
 * LocationPicker — UI tests (LP-1)
 *
 * Leaflet / react-leaflet are mocked; vi.hoisted exposes mutable handler refs
 * so tests can simulate map clicks and marker drag-end without a real DOM layout.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── vi.hoisted: mutable refs captured by mock factories ──────────────────────
const mapInteraction = vi.hoisted(() => ({
  simulateClick: null as ((lat: number, lng: number) => void) | null,
  simulateDragend: null as ((lat: number, lng: number) => void) | null,
}));

// ── Mock react-leaflet ────────────────────────────────────────────────────────
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: ({ url }: { url: string }) => <div data-testid="tile-layer" data-url={url} />,
  Marker: ({
    children,
    position,
    eventHandlers,
  }: {
    children?: React.ReactNode;
    position: [number, number];
    eventHandlers?: { dragend?: (e: unknown) => void };
  }) => {
    // Expose dragend simulation
    mapInteraction.simulateDragend = (lat: number, lng: number) => {
      eventHandlers?.dragend?.({
        target: { getLatLng: () => ({ lat, lng }) },
      });
    };
    return (
      <div
        data-testid="map-marker"
        data-lat={position[0]}
        data-lng={position[1]}
      >
        {children}
      </div>
    );
  },
  useMapEvents: (handlers: { click?: (e: unknown) => void }) => {
    // Expose click simulation
    mapInteraction.simulateClick = (lat: number, lng: number) => {
      handlers.click?.({ latlng: { lat, lng } });
    };
    return null;
  },
  useMap: () => ({ setView: vi.fn(), fitBounds: vi.fn() }),
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts: object) => opts,
    latLngBounds: () => ({}),
    DragEndEvent: class {},
  },
  divIcon: (opts: object) => opts,
  latLngBounds: () => ({}),
  DragEndEvent: class {},
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));

// ── Import component ──────────────────────────────────────────────────────────
import LocationPicker from '../../components/LocationPicker';

// ── Default props ─────────────────────────────────────────────────────────────
const defaultProps = {
  addressLabel: 'Calle Gran Vía 1, Madrid',
  onConfirm: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
};

function renderPicker(overrides: Partial<typeof defaultProps & {
  initialLat: number | null;
  initialLng: number | null;
}> = {}) {
  return render(<LocationPicker {...defaultProps} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mapInteraction.simulateClick = null;
  mapInteraction.simulateDragend = null;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LocationPicker — opening state', () => {
  it('TEST-LP-1: renders dialog with address label', () => {
    renderPicker();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Calle Gran Vía 1, Madrid')).toBeInTheDocument();
  });

  it('TEST-LP-2: with valid initial coords — marker pre-positioned, confirm enabled', () => {
    renderPicker({ initialLat: 40.4, initialLng: -3.7 });
    const marker = screen.getByTestId('map-marker');
    expect(marker).toBeInTheDocument();
    expect(marker.dataset.lat).toBe('40.4');
    expect(marker.dataset.lng).toBe('-3.7');
    const confirmBtn = screen.getByRole('button', { name: /confirmar/i });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('TEST-LP-3: without initial coords — no marker, confirm disabled', () => {
    renderPicker({ initialLat: null, initialLng: null });
    expect(screen.queryByTestId('map-marker')).not.toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /confirmar/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('TEST-LP-3b: without initial coords — instruction banner shown', () => {
    renderPicker({ initialLat: null, initialLng: null });
    // Banner text is unique: "arrástralo" only appears in the top instruction banner
    expect(screen.getByText(/arrástralo para ajustar/i)).toBeInTheDocument();
  });
});

describe('LocationPicker — map interaction', () => {
  it('TEST-LP-4: click on map places marker and enables confirm', async () => {
    renderPicker({ initialLat: null, initialLng: null });
    expect(screen.queryByTestId('map-marker')).not.toBeInTheDocument();

    await act(async () => {
      mapInteraction.simulateClick!(41.38, 2.17);
    });

    const marker = await screen.findByTestId('map-marker');
    expect(marker.dataset.lat).toBe('41.38');
    expect(marker.dataset.lng).toBe('2.17');
    expect(screen.getByRole('button', { name: /confirmar/i })).not.toBeDisabled();
  });

  it('TEST-LP-5: drag marker updates coordinates shown in footer', async () => {
    renderPicker({ initialLat: 40.4, initialLng: -3.7 });

    await act(async () => {
      mapInteraction.simulateDragend!(41.0, -4.0);
    });

    const coords = screen.getByTestId('lp-coords');
    expect(coords.textContent).toContain('41.00000');
    expect(coords.textContent).toContain('-4.00000');
  });
});

describe('LocationPicker — confirmation flow', () => {
  it('TEST-LP-6: confirm calls onConfirm with current coordinates', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderPicker({ initialLat: 40.4, initialLng: -3.7, onConfirm });

    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(40.4, -3.7);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('TEST-LP-7: shows saving state during async onConfirm', async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn().mockReturnValue(new Promise<void>(r => { resolve = r; }));
    renderPicker({ initialLat: 40.4, initialLng: -3.7, onConfirm });

    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    expect(await screen.findByText(/guardando/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled();

    await act(async () => { resolve(); });
  });

  it('TEST-LP-8: double-click confirm does not call onConfirm twice', async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn().mockReturnValue(new Promise<void>(r => { resolve = r; }));
    renderPicker({ initialLat: 40.4, initialLng: -3.7, onConfirm });

    const btn = screen.getByRole('button', { name: /confirmar/i });
    await userEvent.click(btn);
    // Button is now disabled/saving — second click is a no-op
    fireEvent.click(btn);

    await act(async () => { resolve(); });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('TEST-LP-9: onConfirm error shows error message, does not close', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Fallo de red'));
    renderPicker({ initialLat: 40.4, initialLng: -3.7, onConfirm });

    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    const errorEl = await screen.findByTestId('lp-error');
    expect(errorEl).toHaveTextContent('Fallo de red');
    // Dialog stays open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('LocationPicker — cancel flow', () => {
  it('TEST-LP-10: cancel button calls onCancel without calling onConfirm', async () => {
    const onConfirm = vi.fn();
    const onCancel  = vi.fn();
    renderPicker({ onConfirm, onCancel });

    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('TEST-LP-11: Escape key calls onCancel when not saving', async () => {
    const onCancel = vi.fn();
    renderPicker({ onCancel });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('TEST-LP-11b: Escape key blocked while saving', async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn().mockReturnValue(new Promise<void>(r => { resolve = r; }));
    const onCancel  = vi.fn();
    renderPicker({ initialLat: 40.4, initialLng: -3.7, onConfirm, onCancel });

    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await screen.findByText(/guardando/i);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => { resolve(); });
  });
});

describe('LocationPicker — CARTO not configured', () => {
  it('TEST-LP-12: shows "Mapa no disponible" when CARTO_KEY is absent', async () => {
    // Stub env before dynamic import to isolate module
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', '');
    vi.resetModules();

    const { default: LP } = await import('../../components/LocationPicker');
    render(<LP {...defaultProps} />);

    expect(screen.getByText(/mapa no disponible/i)).toBeInTheDocument();
    expect(screen.getByText(/VITE_CARTO_BASEMAP_API_KEY/)).toBeInTheDocument();
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe('LocationPicker — RouteMap compatibility', () => {
  it('TEST-LP-13: isValidLatLng used for initial coords rejects NaN', () => {
    renderPicker({ initialLat: NaN, initialLng: -3.7 });
    expect(screen.queryByTestId('map-marker')).not.toBeInTheDocument();
  });

  it('TEST-LP-13b: isValidLatLng rejects out-of-range latitude', () => {
    renderPicker({ initialLat: 200, initialLng: -3.7 });
    expect(screen.queryByTestId('map-marker')).not.toBeInTheDocument();
  });
});
