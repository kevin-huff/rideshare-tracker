import Fastify from 'fastify';
import { initDb } from './db.js';
import { shiftRoutes } from './routes/shifts.js';
import { rideRoutes } from './routes/rides.js';
import { locationRoutes } from './routes/location.js';
import { overlayRoutes } from './routes/overlay.js';
import { expenseRoutes } from './routes/expenses.js';
import { settingsRoutes } from './routes/settings.js';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';

export function build(dbPath?: string) {
    const server = Fastify({
        logger: {
            level: 'info'
        }
    });

    // Initialize DB
    initDb(dbPath);

    // Serve receipts if present
    const receiptsDir = process.env.RECEIPTS_DIR || path.join(process.cwd(), 'receipts');
    fs.mkdirSync(receiptsDir, { recursive: true });
    server.register(fastifyStatic, {
        root: receiptsDir,
        prefix: '/receipts/'
    });

    server.register(shiftRoutes);
    server.register(rideRoutes);
    server.register(locationRoutes);
    server.register(overlayRoutes);
    server.register(expenseRoutes);
    server.register(settingsRoutes);

    server.get('/health', async (request, reply) => {
        return { status: 'ok' };
    });

    return server;
}
