import Fastify from 'fastify';
import { initDb } from './db.js';
import { shiftRoutes } from './routes/shifts.js';

export function build() {
    const server = Fastify({
        logger: {
            level: 'info'
        }
    });

    // Initialize DB
    initDb();

    server.register(shiftRoutes);

    server.get('/health', async (request, reply) => {
        return { status: 'ok' };
    });

    return server;
}
