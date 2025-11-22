import { FastifyInstance } from 'fastify';
import { getDb } from '../db.js';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireToken } from '../auth.js';
import { overlayEmitter } from './overlay.js';

const ShiftSchema = z.object({});
const ShiftIdParams = z.object({
    id: z.string().uuid()
});

export async function shiftRoutes(fastify: FastifyInstance) {
    fastify.post('/v1/shifts', async (request, reply) => {
        if (!requireToken(request, reply)) {
            return;
        }

        try {
            ShiftSchema.parse(request.body ?? {});
        } catch (e) {
            return reply.status(400).send({ error: 'Invalid request body' });
        }

        const db = getDb();
        const activeShift = db.prepare('SELECT id FROM shifts WHERE ended_at IS NULL').get();
        if (activeShift) {
            return reply.status(409).send({ error: 'A shift is already active' });
        }

        const id = randomUUID();
        const started_at = new Date().toISOString();

        db.prepare('INSERT INTO shifts (id, started_at) VALUES (?, ?)').run(id, started_at);

        overlayEmitter.emit('update');

        return { id, started_at };
    });

    fastify.patch('/v1/shifts/:id/end', async (request, reply) => {
        if (!requireToken(request, reply)) {
            return;
        }

        const parsedParams = ShiftIdParams.safeParse(request.params);
        if (!parsedParams.success) {
            return reply.status(400).send({ error: 'Invalid shift id' });
        }

        const db = getDb();
        const shift = db.prepare('SELECT id, ended_at FROM shifts WHERE id = ?').get(parsedParams.data.id);

        if (!shift) {
            return reply.status(404).send({ error: 'Shift not found' });
        }

        if (shift.ended_at) {
            return reply.status(409).send({ error: 'Shift already ended' });
        }

        const ended_at = new Date().toISOString();
        db.prepare('UPDATE shifts SET ended_at = ? WHERE id = ?').run(ended_at, parsedParams.data.id);

        overlayEmitter.emit('update');

        return { id: parsedParams.data.id, ended_at };
    });
}
