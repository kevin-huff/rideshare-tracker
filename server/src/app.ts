import Fastify from 'fastify';
import { initDb } from './db.js';
import { shiftRoutes } from './routes/shifts.js';

export function build(dbPath?: string) {
    const server = Fastify({
        logger: {
            level: 'info'
        }
    });

    // Initialize DB
    initDb(dbPath);

    server.register(shiftRoutes);

    server.get('/health', async (request, reply) => {
        return { status: 'ok' };
    });

    return server;
}
