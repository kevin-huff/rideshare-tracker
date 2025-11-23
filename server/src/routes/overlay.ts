import { FastifyInstance } from 'fastify';
import { getDb } from '../db.js';
import EventEmitter from 'events';
import { getOverlayTheme, getSettings } from '../settings.js';

function formatCoords(lat?: number | null, lng?: number | null) {
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
        return '—';
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function redactCoordinate(lat: number, lng: number, radiusMeters: number) {
    if (radiusMeters <= 0) {
        return { lat, lng };
    }
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
    const latStep = radiusMeters / metersPerDegreeLat;
    const lngStep = radiusMeters / metersPerDegreeLng;

    return {
        lat: Math.round(lat / latStep) * latStep,
        lng: Math.round(lng / lngStep) * lngStep
    };
}

function applyPrivacy(payload: any, opts: { hide: boolean; radius: number }) {
    if (!payload.shiftActive) {
        return { ...payload, path: [], markers: { pickup: null, dropoff: null } };
    }

    if (opts.hide) {
        return {
            ...payload,
            path: [],
            markers: { pickup: null, dropoff: null },
            lastRide: payload.lastRide
                ? { ...payload.lastRide, pickup: 'Hidden', dropoff: 'Hidden' }
                : null
        };
    }

    const redactedPath = opts.radius > 0
        ? payload.path.map(([lng, lat]: [number, number]) => {
              const redacted = redactCoordinate(lat, lng, opts.radius);
              return [redacted.lng, redacted.lat];
          })
        : payload.path;

    const redactMarker = (marker: any) => {
        if (!marker) return null;
        const redacted = opts.radius > 0
            ? redactCoordinate(marker.lat, marker.lng, opts.radius)
            : marker;
        return { lat: redacted.lat, lng: redacted.lng };
    };

    const pickupMarker = redactMarker(payload.markers?.pickup);
    const dropoffMarker = redactMarker(payload.markers?.dropoff);

    const lastRide = payload.lastRide
        ? {
              ...payload.lastRide,
              pickup: pickupMarker ? formatCoords(pickupMarker.lat, pickupMarker.lng) : '—',
              dropoff: dropoffMarker ? formatCoords(dropoffMarker.lat, dropoffMarker.lng) : '—'
          }
        : null;

    return {
        ...payload,
        path: redactedPath,
        markers: { pickup: pickupMarker, dropoff: dropoffMarker },
        lastRide
    };
}

function buildOverlayPayload() {
    const db = getDb();
    const settings = getSettings();
    const theme = getOverlayTheme(settings.overlay_theme);

    const shift = db
        .prepare('SELECT * FROM shifts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1')
        .get();

    if (!shift) {
        return {
            shiftActive: false,
            metrics: {
                rides: 0,
                earnings_cents: 0,
                tips_cents: 0,
                distance_miles: 0,
                duration_seconds: 0,
                rate_per_hour: 0
            },
            lastRide: null,
            path: [],
            markers: { pickup: null, dropoff: null },
            theme,
            privacy: { radius_m: settings.overlay_privacy_radius_m, hide: Boolean(settings.overlay_hide_location) }
        };
    }

    const durationSeconds = Math.floor(
        (Date.now() - new Date(shift.started_at).getTime()) / 1000
    );
    const totalEarningsCents = shift.earnings_cents + shift.tips_cents;
    const ratePerHour =
        durationSeconds > 0 ? (totalEarningsCents / 100) / (durationSeconds / 3600) : 0;

    const lastRide = db
        .prepare(
            `SELECT * FROM rides
             WHERE shift_id = ?
             ORDER BY (ended_at IS NULL) DESC, ended_at DESC, started_at DESC
             LIMIT 1`
        )
        .get(shift.id);

    const pings = db
        .prepare(
            `SELECT lat, lng FROM location_pings
             WHERE shift_id = ?
             ORDER BY ts ASC
             LIMIT 500`
        )
        .all(shift.id);

    const payload = {
        shiftActive: true,
        metrics: {
            rides: shift.ride_count,
            earnings_cents: totalEarningsCents,
            tips_cents: shift.tips_cents,
            distance_miles: shift.distance_miles,
            duration_seconds: durationSeconds,
            rate_per_hour: ratePerHour
        },
        lastRide: lastRide
            ? {
                  id: lastRide.id,
                  total_cents: (lastRide.gross_cents ?? 0) + (lastRide.tip_cents ?? 0),
                  at: lastRide.ended_at ?? lastRide.started_at,
                  pickup: formatCoords(lastRide.pickup_lat, lastRide.pickup_lng),
                  dropoff: formatCoords(lastRide.dropoff_lat, lastRide.dropoff_lng)
              }
            : null,
        path: pings.map((p: any) => [p.lng, p.lat]),
        markers: {
            pickup: lastRide && lastRide.pickup_lat
                ? { lng: lastRide.pickup_lng, lat: lastRide.pickup_lat }
                : null,
            dropoff: lastRide && lastRide.dropoff_lat
                ? { lng: lastRide.dropoff_lng, lat: lastRide.dropoff_lat }
                : null
        },
        theme,
        privacy: {
            radius_m: settings.overlay_privacy_radius_m,
            hide: Boolean(settings.overlay_hide_location)
        }
    };

    return applyPrivacy(payload, {
        hide: Boolean(settings.overlay_hide_location),
        radius: settings.overlay_privacy_radius_m ?? 0
    });
}

export const overlayEmitter = new EventEmitter();

function overlayHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rideshare Overlay</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
  <link href="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js"></script>
  <style>
    :root {
      --glass: rgba(10,12,22,0.7);
      --text: #eef2ff;
      --muted: #94a3b8;
      --success: #6ef2c4;
      --danger: #ff7b7b;
      --accent: #7dd3fc;
      --bg: #030712;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: 'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
      color: var(--text);
      background: radial-gradient(circle at 20% 20%, rgba(125,211,252,0.12), transparent 35%),
                  radial-gradient(circle at 80% 0%, rgba(252,165,165,0.08), transparent 35%),
                  var(--bg);
      overflow: hidden;
    }
    .overlay {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }
    .map {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
      backdrop-filter: blur(4px);
    }
    .hud {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--glass);
      border: 1px solid rgba(255,255,255,0.07);
      font-size: 13px;
      color: var(--muted);
      letter-spacing: 0.02em;
    }
    .pill strong {
      color: var(--text);
      font-weight: 600;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 12px;
      background: linear-gradient(120deg, rgba(125,211,252,0.14), rgba(110,242,196,0.18));
      color: var(--text);
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      font-size: 12px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    .card {
      background: var(--glass);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 14px 14px 12px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
    }
    .label {
      font-size: 13px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .metric {
      font-size: 34px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--text);
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .metric .sub {
      font-size: 16px;
      color: var(--muted);
      font-weight: 500;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .muted {
      color: var(--muted);
      font-size: 13px;
    }
    .last-ride {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 6px;
      margin-top: 6px;
    }
    .small {
      font-size: 12px;
      color: var(--muted);
      letter-spacing: 0.02em;
    }
    .pulse {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 0 0 rgba(110,242,196,0.5);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(110,242,196,0.5); }
      70% { box-shadow: 0 0 0 10px rgba(110,242,196,0); }
      100% { box-shadow: 0 0 0 0 rgba(110,242,196,0); }
    }
  </style>
</head>
  <body>
  <div class="overlay">
    <div class="map" id="map"></div>
    <div class="hud">
      <div class="header">
        <div class="status" id="shift-status"><span class="pulse"></span> Shift Active</div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="label">Rides</div>
          <div class="metric" id="metric-rides">0</div>
          <div class="muted">Completed this shift</div>
        </div>
        <div class="card">
          <div class="label">Earnings</div>
          <div class="metric" id="metric-earnings">$0<span class="sub">incl tips</span></div>
          <div class="row">
            <span class="muted">Tips</span>
            <span class="muted" id="metric-tips">$0</span>
          </div>
        </div>
        <div class="card">
          <div class="label">$ / hr</div>
          <div class="metric" id="metric-rate">$0<span class="sub">/hr</span></div>
          <div class="row">
            <span class="muted">On shift</span>
            <span class="muted" id="metric-duration">0h 00m</span>
          </div>
        </div>
        <div class="card">
          <div class="label">Last Ride</div>
          <div class="metric" id="metric-last">$0<span class="sub" id="metric-last-time">—</span></div>
          <div class="last-ride">
            <div class="small">Pickup: <span id="metric-pickup">—</span></div>
            <div class="small">Dropoff: <span id="metric-dropoff">—</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let map;
    let mapReady = false;
    let startMarker = null;
    let endMarker = null;

    function hexToRgba(hex, alpha) {
      if (!hex) return '';
      const normalized = hex.replace('#', '');
      const bigint = parseInt(normalized, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
    }

    function applyTheme(theme) {
      if (!theme) return;
      const root = document.documentElement;
      root.style.setProperty('--glass', theme.glass);
      root.style.setProperty('--text', theme.text);
      root.style.setProperty('--muted', theme.muted);
      root.style.setProperty('--success', theme.success);
      root.style.setProperty('--danger', theme.danger);
      root.style.setProperty('--accent', theme.accent);
      root.style.setProperty('--bg', theme.background);
      document.body.style.background =
        'radial-gradient(circle at 20% 20%, ' + hexToRgba(theme.accent,0.16) +
        ', transparent 36%), radial-gradient(circle at 80% 0%, ' + hexToRgba(theme.danger,0.1) +
        ', transparent 32%), ' + theme.background;
    }

    function formatCents(cents) {
      return '$' + (cents / 100).toFixed(2);
    }

    function render(data) {
      applyTheme(data.theme);
      const active = data.shiftActive;
      document.getElementById('metric-rides').textContent = active ? data.metrics.rides.toString() : '0';
      document.getElementById('metric-earnings').innerHTML = active ? formatCents(data.metrics.earnings_cents) + '<span class="sub">incl tips</span>' : '$0<span class="sub">incl tips</span>';
      document.getElementById('metric-tips').textContent = active ? formatCents(data.metrics.tips_cents) : '$0';
      document.getElementById('metric-rate').innerHTML = active ? '$' + (data.metrics.rate_per_hour ?? 0).toFixed(2) + '<span class="sub">/hr</span>' : '$0<span class="sub">/hr</span>';
      const durationSeconds = active ? data.metrics.duration_seconds : 0;
      const hours = Math.floor(durationSeconds / 3600);
      const mins = Math.floor((durationSeconds % 3600) / 60);
      document.getElementById('metric-duration').textContent = active ? hours + 'h ' + mins.toString().padStart(2, '0') + 'm' : '0h 00m';

      if (active && data.lastRide) {
        document.getElementById('metric-last').innerHTML = formatCents(data.lastRide.total_cents) + '<span class="sub" id="metric-last-time">' + data.lastRide.at + '</span>';
        document.getElementById('metric-pickup').textContent = data.lastRide.pickup;
        document.getElementById('metric-dropoff').textContent = data.lastRide.dropoff;
      } else {
        document.getElementById('metric-last').innerHTML = '$0<span class="sub" id="metric-last-time">—</span>';
        document.getElementById('metric-pickup').textContent = '—';
        document.getElementById('metric-dropoff').textContent = '—';
      }

      const status = document.getElementById('shift-status');
      status.textContent = active ? ' Shift Active' : ' Shift Paused';
      const pulse = document.createElement('span');
      pulse.className = 'pulse';
      status.prepend(pulse);
    }

    function ensureMap() {
      if (map) return;
      map = new maplibregl.Map({
        container: 'map',
        style: 'https://demotiles.maplibre.org/style.json',
        center: [-122.4194, 37.7749],
        zoom: 12,
        interactive: false
      });
      map.on('load', () => {
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#6ef2c4', 'line-width': 4, 'line-opacity': 0.8 }
        });
        mapReady = true;
    });
}

    function updateMap(path) {
      if (!mapReady) return;
      const coords = path ?? [];
      const source = map.getSource('route');
      if (source) {
        source.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });
      }
      if (coords.length > 1) {
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, { padding: 30, maxZoom: 15, duration: 0 });
      }

      // Update start/end markers
      if (startMarker) startMarker.remove();
      if (endMarker) endMarker.remove();
      startMarker = null;
      endMarker = null;
      if (coords.length > 0) {
        startMarker = new maplibregl.Marker({ color: '#6ef2c4' }).setLngLat(coords[0]).addTo(map);
        endMarker = new maplibregl.Marker({ color: '#ff7b7b' }).setLngLat(coords[coords.length - 1]).addTo(map);
      }
    }

    function updateMarkers(markers) {
      if (!mapReady) return;
      if (!markers?.pickup && startMarker) {
        startMarker.remove();
        startMarker = null;
      }
      if (!markers?.dropoff && endMarker) {
        endMarker.remove();
        endMarker = null;
      }
      if (markers?.pickup) {
        if (startMarker) startMarker.remove();
        startMarker = new maplibregl.Marker({ color: '#6ef2c4' })
          .setLngLat([markers.pickup.lng, markers.pickup.lat])
          .addTo(map);
      }
      if (markers?.dropoff) {
        if (endMarker) endMarker.remove();
        endMarker = new maplibregl.Marker({ color: '#ff7b7b' })
          .setLngLat([markers.dropoff.lng, markers.dropoff.lat])
          .addTo(map);
      }
    }

let eventSource = null;

function connectStream() {
  try {
        eventSource = new EventSource('/overlay/stream');
        eventSource.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            render(data);
            updateMap(data.path);
            updateMarkers(data.markers);
          } catch (e) {
            console.error('Failed to parse stream payload', e);
          }
        };
        eventSource.onerror = () => {
          console.warn('Overlay stream error, retrying in 5s');
          eventSource.close();
          setTimeout(connectStream, 5000);
        };
      } catch (err) {
        console.error('Failed to connect stream', err);
      }
    }

    ensureMap();
    connectStream();
  </script>
</body>
</html>`;
}

export async function overlayRoutes(fastify: FastifyInstance) {
    fastify.get('/overlay', async (_request, reply) => {
        const html = overlayHtml();
        reply.header('content-type', 'text/html; charset=utf-8').send(html);
    });

    fastify.get('/overlay/data', async (_request, reply) => {
        const response = buildOverlayPayload();
        reply.header('content-type', 'application/json').send(response);
    });

    fastify.get('/overlay/stream', async (_request, reply) => {
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');

        const send = () => {
            const payload = buildOverlayPayload();
            reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
        };

        const interval = setInterval(send, 5000);
        const listener = () => send();
        overlayEmitter.on('update', listener);
        send();

        reply.raw.on('close', () => {
            clearInterval(interval);
            overlayEmitter.off('update', listener);
        });
    });
}
