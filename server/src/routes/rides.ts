import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireToken } from '../auth.js';
import { overlayEmitter } from './overlay.js';

const StartRideSchema = z.object({
    shift_id: z.string().uuid()
});

const EndRideParams = z.object({
    id: z.string().uuid()
});

const EndRideSchema = z.object({
    gross_cents: z.number().int().nonnegative(),
    dropoff_lat: z.number().optional(),
    dropoff_lng: z.number().optional(),
    dropoff_at: z.string().optional(),
    distance_miles: z.number().nonnegative().optional()
});

const TipParams = z.object({
    id: z.string().uuid()
});

const TipSchema = z.object({
    tip_cents: z.number().int().nonnegative()
});

export async function rideRoutes(fastify: FastifyInstance) {
    fastify.post('/v1/rides', async (request, reply) => {
        if (!requireToken(request, reply)) {
            return;
        }

        const parsed = StartRideSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid request body' });
        }

        const db = getDb();

        const shift = db
            .prepare('SELECT id, ended_at FROM shifts WHERE id = ?')
            .get(parsed.data.shift_id);

        if (!shift) {
            return reply.status(404).send({ error: 'Shift not found' });
        }

        if (shift.ended_at) {
            return reply.status(409).send({ error: 'Shift already ended' });
        }

        const activeRide = db
            .prepare('SELECT id FROM rides WHERE shift_id = ? AND ended_at IS NULL')
            .get(parsed.data.shift_id);

        if (activeRide) {
            return reply.status(409).send({ error: 'A ride is already active for this shift' });
        }

        const id = randomUUID();
        const started_at = new Date().toISOString();

        db.prepare(
            `INSERT INTO rides (id, shift_id, status, started_at, pickup_at)
             VALUES (?, ?, ?, ?, ?)`
        ).run(id, parsed.data.shift_id, 'in_progress', started_at, started_at);

        overlayEmitter.emit('update');

        return { id, started_at };
    });

    fastify.patch('/v1/rides/:id/end', async (request, reply) => {
        if (!requireToken(request, reply)) {
            return;
        }

        const params = EndRideParams.safeParse(request.params);
        if (!params.success) {
            return reply.status(400).send({ error: 'Invalid ride id' });
        }

        const body = EndRideSchema.safeParse(request.body ?? {});
        if (!body.success) {
            return reply.status(400).send({ error: 'Invalid request body' });
        }

        const db = getDb();
        const ride = db
            .prepare('SELECT id, shift_id, ended_at FROM rides WHERE id = ?')
            .get(params.data.id);

        if (!ride) {
            return reply.status(404).send({ error: 'Ride not found' });
        }

        if (ride.ended_at) {
            return reply.status(409).send({ error: 'Ride already ended' });
        }

        const shift = db.prepare('SELECT id, ended_at FROM shifts WHERE id = ?').get(ride.shift_id);
        if (!shift) {
            return reply.status(404).send({ error: 'Shift not found' });
        }
        if (shift.ended_at) {
            return reply.status(409).send({ error: 'Shift already ended' });
        }

        const ended_at = body.data.dropoff_at ?? new Date().toISOString();
        const updateRide = db.prepare(
            `UPDATE rides
             SET status = 'completed',
                 ended_at = ?,
                 dropoff_at = ?,
                 gross_cents = ?,
                 dropoff_lat = ?,
                 dropoff_lng = ?,
                 distance_miles = COALESCE(distance_miles, 0) + COALESCE(?, 0)
             WHERE id = ?`
        );

        const updateShift = db.prepare(
            `UPDATE shifts
             SET ride_count = ride_count + 1,
                 earnings_cents = earnings_cents + ?,
                 distance_miles = distance_miles + COALESCE(?, 0)
             WHERE id = ?`
        );

        const runTransaction = db.transaction(() => {
            updateRide.run(
                ended_at,
                ended_at,
                body.data.gross_cents,
                body.data.dropoff_lat ?? null,
                body.data.dropoff_lng ?? null,
                body.data.distance_miles ?? null,
                params.data.id
            );
            updateShift.run(body.data.gross_cents, body.data.distance_miles ?? null, ride.shift_id);
        });

        runTransaction();

        overlayEmitter.emit('update');

        return { id: params.data.id, ended_at, gross_cents: body.data.gross_cents };
    });

    fastify.post('/v1/rides/:id/tips', async (request, reply) => {
        if (!requireToken(request, reply)) {
            return;
        }

        const params = TipParams.safeParse(request.params);
        if (!params.success) {
            return reply.status(400).send({ error: 'Invalid ride id' });
        }

        const body = TipSchema.safeParse(request.body ?? {});
        if (!body.success) {
            return reply.status(400).send({ error: 'Invalid request body' });
        }

        const db = getDb();
        const ride = db
            .prepare('SELECT id, shift_id FROM rides WHERE id = ?')
            .get(params.data.id);

        if (!ride) {
            return reply.status(404).send({ error: 'Ride not found' });
        }

        const updateRide = db.prepare(
            `UPDATE rides
             SET tip_cents = tip_cents + ?
             WHERE id = ?`
        );
        const updateShift = db.prepare(
            `UPDATE shifts
             SET tips_cents = tips_cents + ?
             WHERE id = ?`
        );

        const runTransaction = db.transaction(() => {
            updateRide.run(body.data.tip_cents, params.data.id);
            updateShift.run(body.data.tip_cents, ride.shift_id);
        });

        runTransaction();

        overlayEmitter.emit('update');

        return { id: params.data.id, tip_cents: body.data.tip_cents };
    });
}
