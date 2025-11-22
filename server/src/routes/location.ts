import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireToken } from '../auth.js';
import { overlayEmitter } from './overlay.js';

const LocationPingSchema = z.object({
    ts: z.string(),
    lat: z.number(),
    lng: z.number(),
    speed_mps: z.number().optional(),
    heading_deg: z.number().optional(),
    accuracy_m: z.number().optional(),
    source: z.string().optional()
});

const LocationBatchSchema = z.object({
    shift_id: z.string().uuid(),
    ride_id: z.string().uuid().optional(),
    pings: z.array(LocationPingSchema).min(1)
});

export async function locationRoutes(fastify: FastifyInstance) {
    fastify.post('/v1/location', async (request, reply) => {
        if (!requireToken(request, reply)) {
            return;
        }

        const parsed = LocationBatchSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid request body' });
        }

        const { shift_id, ride_id, pings } = parsed.data;
        const db = getDb();

        const shift = db
            .prepare('SELECT id, ended_at FROM shifts WHERE id = ?')
            .get(shift_id);

        if (!shift) {
            return reply.status(404).send({ error: 'Shift not found' });
        }
        if (shift.ended_at) {
            return reply.status(409).send({ error: 'Shift already ended' });
        }

        if (ride_id) {
            const ride = db
                .prepare('SELECT id, shift_id FROM rides WHERE id = ?')
                .get(ride_id);
            if (!ride || ride.shift_id !== shift_id) {
                return reply.status(404).send({ error: 'Ride not found' });
            }
        }

        const stmt = db.prepare(
            `INSERT INTO location_pings (shift_id, ride_id, ts, lat, lng, speed_mps, heading_deg, accuracy_m, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        const runTransaction = db.transaction(() => {
            for (const ping of pings) {
                stmt.run(
                    shift_id,
                    ride_id ?? null,
                    ping.ts,
                    ping.lat,
                    ping.lng,
                    ping.speed_mps ?? null,
                    ping.heading_deg ?? null,
                    ping.accuracy_m ?? null,
                    ping.source ?? null
                );
            }
        });

        runTransaction();

        overlayEmitter.emit('update');

        return { inserted: pings.length };
    });
}
