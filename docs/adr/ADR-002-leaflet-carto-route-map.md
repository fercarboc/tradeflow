# ADR-002 — Mapa de ruta integrado: Leaflet + CARTO Basemaps

**Fecha:** 2026-10-19  
**Estado:** Aceptado  
**Componente:** `src/components/RouteMap.tsx`, `src/components/ScreenRutaDia.tsx`

---

## Contexto

La pantalla de Ruta del Día (`ScreenRutaDia`) mostraba los trabajos del día como una lista lineal sin referencia geográfica. El técnico tenía que abrir Google Maps externamente para orientarse. El objetivo era integrar un mapa interactivo directamente en la pantalla, con marcadores numerados por orden de ruta y ajuste automático de encuadre.

---

## Decisión

### Librería de mapas: Leaflet + React Leaflet

Se usa **Leaflet 1.9.4** + **React Leaflet 5.0.0** (primera versión con `react: "^19.0.0"` como peer dependency).

**Motivo:** madurez, zero-dependency en servidor (solo cliente), ausencia de cuota propia de llamadas, tamaño de bundle contenido (~42 KB gzip). Alternativas descartadas: Google Maps JS API (coste por carga de mapa), Mapbox GL (WebGL obligatorio, licencia más restrictiva).

### Proveedor de tiles: CARTO Basemaps

URL: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=KEY`

**Motivo:** tier comercial gratuito (1 M tiles/mes), aspecto cartográfico limpio, registro sin tarjeta.

**Condiciones obligatorias (CARTO ToS §8):**
- API key obligatoria para uso comercial (obtenida en `carto.com/basemaps/apikey/`).
- Dominio de producción restringido en el panel de CARTO (no en el código).
- Atribución OSM + CARTO en el mapa (`TileLayer attribution`).

### Variable de entorno: `VITE_CARTO_BASEMAP_API_KEY`

- Prefijo `VITE_` → Vite incrusta el valor en el bundle cliente en tiempo de build.
- Seguridad mediante restricción de dominio en CARTO, no por secreto.
- **Nunca versionar** el archivo `.env.local` ni `.env.production`. Solo `.env.example` con placeholder.
- Fallback explícito: si la variable está ausente, el componente muestra "Mapa no disponible" y no realiza ninguna petición a CARTO.

### Iconos: `L.divIcon` (no imágenes por defecto)

Los marcadores se crean con `L.divIcon` (HTML inline) para evitar el problema conocido de Vite + Webpack con las rutas de imagen por defecto de Leaflet (`marker-icon.png`, `marker-shadow.png`).

### Validación de coordenadas: `isValidLatLng`

Helper exportado que rechaza `null`, `undefined`, `NaN`, `Infinity` y valores fuera de rango (lat ∈ [-90, 90], lng ∈ [-180, 180]). Aplicado tanto a los trabajos como al punto de inicio (`startLocation`).

### Layout responsivo

- Desktop (`lg:`): grid de 2 columnas. Itinerario izquierda, mapa + resumen derecha.
- Móvil: columna única. Mapa arriba (`order-1`, 224 px fijo), itinerario scrollable debajo (`order-2`).

---

## Consecuencias

### Positivas
- El técnico ve la distribución geográfica del día sin salir de la app.
- El encuadre automático (`fitBounds`) adapta el zoom al conjunto de paradas.
- El enlace "Abrir ruta completa" a Google Maps se preserva para navegación giro a giro.

### Restricciones permanentes
- La optimización de ruta es independiente del proveedor de tiles: se ejecuta contra el motor de `routeOptimizer.ts`, no contra ninguna API cartográfica.
- El mapa es solo visualización. El routing turn-by-turn se delega siempre a Google Maps (enlace externo).
- Si el consumo supera 1 M tiles/mes, activar el plan de pago de CARTO o migrar a OpenStreetMap (Nominatim/Tile Server propio).

### Monitorización
- Revisar el dashboard de CARTO mensualmente durante los 3 primeros meses de uso en producción para validar que el consumo se mantiene dentro del tier gratuito.
