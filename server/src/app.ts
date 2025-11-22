import Fastify from 'fastify';
import { initDb } from './db.js';
import { shiftRoutes } from './routes/shifts.js';
import { rideRoutes } from './routes/rides.js';
import { locationRoutes } from './routes/location.js';
import { overlayRoutes } from './routes/overlay.js';

export function build(dbPath?: string) {
    const server = Fastify({
        logger: {
            level: 'info'
        }
    });

    // Initialize DB
    initDb(dbPath);

    server.register(shiftRoutes);
    server.register(rideRoutes);
    server.register(locationRoutes);
    server.register(overlayRoutes);

    server.get('/health', async (request, reply) => {
        return { status: 'ok' };
    });

    return server;
}
