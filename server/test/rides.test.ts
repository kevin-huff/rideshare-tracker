import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { build } from '../src/app.js';
import { closeDb, getDb } from '../src/db.js';

const TEST_DB_PATH = path.join(__dirname, 'rides-test.db');
const TOKEN = 'test-token';
const authHeaders = { authorization: `Bearer ${TOKEN}` };

async function startShift(app: any) {
    const response = await app.inject({
        method: 'POST',
        url: '/v1/shifts',
        headers: authHeaders,
        payload: {}
    });
    expect(response.statusCode).toBe(200);
    return JSON.parse(response.body);
}

async function startRide(app: any, shiftId: string) {
    const response = await app.inject({
        method: 'POST',
        url: '/v1/rides',
        headers: authHeaders,
        payload: { shift_id: shiftId }
    });
    return response;
}

describe('Ride Routes', () => {
    let app: any;

    beforeEach(async () => {
        process.env.DEVICE_TOKEN = TOKEN;
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        app = build(TEST_DB_PATH);
    });

    afterEach(async () => {
        await app.close();
        closeDb();
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    it('POST /v1/rides should require an active shift', async () => {
        const response = await startRide(app, '00000000-0000-0000-0000-000000000000');
        expect(response.statusCode).toBe(404);
    });

    it('POST /v1/rides should create a ride when shift is active', async () => {
        const shift = await startShift(app);
        const response = await startRide(app, shift.id);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('started_at');
    });

    it('POST /v1/rides should prevent multiple active rides per shift', async () => {
        const shift = await startShift(app);
        const first = await startRide(app, shift.id);
        expect(first.statusCode).toBe(200);

        const second = await startRide(app, shift.id);
        expect(second.statusCode).toBe(409);
    });

    it('PATCH /v1/rides/:id/end should complete ride and update shift totals', async () => {
        const shift = await startShift(app);
        const ride = await startRide(app, shift.id);
        const rideBody = JSON.parse(ride.body);

        const endResponse = await app.inject({
            method: 'PATCH',
            url: `/v1/rides/${rideBody.id}/end`,
            headers: authHeaders,
            payload: { gross_cents: 2500, distance_miles: 12.5 }
        });

        expect(endResponse.statusCode).toBe(200);
        const db = getDb();
        const shiftRow = db
            .prepare('SELECT earnings_cents, ride_count, distance_miles FROM shifts WHERE id = ?')
            .get(shift.id);

        expect(shiftRow.earnings_cents).toBe(2500);
        expect(shiftRow.ride_count).toBe(1);
        expect(shiftRow.distance_miles).toBeCloseTo(12.5);
    });

    it('PATCH /v1/rides/:id/end should 409 if already ended', async () => {
        const shift = await startShift(app);
        const ride = await startRide(app, shift.id);
        const rideBody = JSON.parse(ride.body);

        await app.inject({
            method: 'PATCH',
            url: `/v1/rides/${rideBody.id}/end`,
            headers: authHeaders,
            payload: { gross_cents: 1000 }
        });

        const response = await app.inject({
            method: 'PATCH',
            url: `/v1/rides/${rideBody.id}/end`,
            headers: authHeaders,
            payload: { gross_cents: 500 }
        });

        expect(response.statusCode).toBe(409);
    });

    it('POST /v1/rides/:id/tips should add tip to ride and shift', async () => {
        const shift = await startShift(app);
        const ride = await startRide(app, shift.id);
        const rideBody = JSON.parse(ride.body);

        const tipResponse = await app.inject({
            method: 'POST',
            url: `/v1/rides/${rideBody.id}/tips`,
            headers: authHeaders,
            payload: { tip_cents: 300 }
        });

        expect(tipResponse.statusCode).toBe(200);

        const db = getDb();
        const rideRow = db.prepare('SELECT tip_cents FROM rides WHERE id = ?').get(rideBody.id);
        const shiftRow = db.prepare('SELECT tips_cents FROM shifts WHERE id = ?').get(shift.id);
        expect(rideRow.tip_cents).toBe(300);
        expect(shiftRow.tips_cents).toBe(300);
    });

    it('POST /v1/location should store pings for active shift', async () => {
        const shift = await startShift(app);
        const ride = await startRide(app, shift.id);
        const rideBody = JSON.parse(ride.body);

        const response = await app.inject({
            method: 'POST',
            url: '/v1/location',
            headers: authHeaders,
            payload: {
                shift_id: shift.id,
                ride_id: rideBody.id,
                pings: [
                    { ts: new Date().toISOString(), lat: 1.23, lng: 4.56 },
                    { ts: new Date().toISOString(), lat: 7.89, lng: 0.12, speed_mps: 5.5 }
                ]
            }
        });

        expect(response.statusCode).toBe(200);
        const db = getDb();
        const count = db
            .prepare('SELECT COUNT(*) as count FROM location_pings WHERE shift_id = ?')
            .get(shift.id).count;
        expect(count).toBe(2);
    });
});
