import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const OverlayQuery = z.object({
    channel: z.string().trim().min(1).default('demo'),
    token: z.string().trim().optional()
});

function escapeAttribute(value: string) {
    return value.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function overlayHtml(channel: string, token?: string) {
    const safeChannel = escapeAttribute(channel);
    const safeToken = token ? escapeAttribute(token) : '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rideshare Overlay</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --glass: rgba(10,12,22,0.65);
      --text: #eef2ff;
      --muted: #94a3b8;
      --success: #6ef2c4;
      --danger: #ff7b7b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: 'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
      color: var(--text);
      background: transparent;
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
      background: rgba(110,242,196,0.12);
      color: var(--success);
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      font-size: 12px;
      border: 1px solid rgba(110,242,196,0.3);
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
        <div class="pill">Channel <strong id="channel">${safeChannel}</strong></div>
        <div class="status" id="shift-status"><span class="pulse"></span> Shift Active</div>
        <div class="pill">Token <strong id="token">${safeToken ? '••••••••' : 'none'}</strong></div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="label">Rides</div>
          <div class="metric" id="metric-rides">0</div>
          <div class="muted">Completed this shift</div>
        </div>
        <div class="card">
          <div class="label">Earnings</div>
          <div class="metric" id="metric-earnings">$0<span class="sub">gross</span></div>
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
    const state = {
      channel: ${JSON.stringify(safeChannel)},
      token: ${JSON.stringify(safeToken)},
      data: {
        rides: 3,
        earnings: 12850,
        tips: 2300,
        ratePerHour: 32,
        shiftDuration: '2h 15m',
        lastRide: { total: 1825, at: '8:42 PM', pickup: 'Market St', dropoff: 'Sunset Ave' },
        shiftActive: true
      }
    };

    function formatCents(cents) {
      return '$' + (cents / 100).toFixed(2);
    }

    function render(data) {
      document.getElementById('metric-rides').textContent = data.rides.toString();
      document.getElementById('metric-earnings').innerHTML = formatCents(data.earnings) + '<span class="sub">gross</span>';
      document.getElementById('metric-tips').textContent = formatCents(data.tips);
      document.getElementById('metric-rate').innerHTML = '$' + data.ratePerHour.toFixed(2) + '<span class="sub">/hr</span>';
      document.getElementById('metric-duration').textContent = data.shiftDuration;
      document.getElementById('metric-last').innerHTML = formatCents(data.lastRide.total) + '<span class="sub" id="metric-last-time">' + data.lastRide.at + '</span>';
      document.getElementById('metric-pickup').textContent = data.lastRide.pickup;
      document.getElementById('metric-dropoff').textContent = data.lastRide.dropoff;
      const status = document.getElementById('shift-status');
      status.textContent = data.shiftActive ? ' Shift Active' : ' Shift Paused';
      const pulse = document.createElement('span');
      pulse.className = 'pulse';
      status.prepend(pulse);
    }

    render(state.data);
    // TODO: hook up WebSocket updates using channel/token once server-side streaming is added.
  </script>
</body>
</html>`;
}

export async function overlayRoutes(fastify: FastifyInstance) {
    fastify.get('/overlay', async (request, reply) => {
        const parsed = OverlayQuery.safeParse(request.query ?? {});
        if (!parsed.success) {
            return reply.status(400).send('Invalid query');
        }

        const html = overlayHtml(parsed.data.channel, parsed.data.token);
        reply.header('content-type', 'text/html; charset=utf-8').send(html);
    });
}
