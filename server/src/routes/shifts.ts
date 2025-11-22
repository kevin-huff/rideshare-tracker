import { FastifyInstance } from 'fastify';
import db from '../db.js';
import { randomUUID } from 'crypto';

export async function shiftRoutes(fastify: FastifyInstance) {
    fastify.post('/v1/shifts', async (request, reply) => {
        const id = randomUUID();
        const started_at = new Date().toISOString();

        const stmt = db.prepare('INSERT INTO shifts (id, started_at) VALUES (?, ?)');
        stmt.run(id, started_at);

        return { id, started_at };
    });
}
