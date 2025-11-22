import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { closeDb, getDb } from '../src/db.js';
import { build } from '../src/app.js';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, 'overlay-test.db');

describe('Overlay Route', () => {
    let app: any;

    beforeEach(async () => {
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

    it('serves overlay html without auth', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/overlay'
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.body).toContain('Rides');
        expect(response.body).toContain('Shift Active');
    });

    it('returns overlay data with active shift and totals include tips', async () => {
        const db = getDb();
        const now = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        db.prepare(
            `INSERT INTO shifts (id, started_at, earnings_cents, tips_cents, distance_miles, ride_count)
             VALUES ('shift-1', ?, 2500, 300, 12.5, 2)`
        ).run(now);
        db.prepare(
            `INSERT INTO rides (id, shift_id, status, started_at, ended_at, gross_cents, tip_cents, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
             VALUES ('ride-1', 'shift-1', 'completed', ?, ?, 1500, 200, 37.77, -122.41, 37.78, -122.42)`
        ).run(now, now);
        db.prepare(
            `INSERT INTO location_pings (shift_id, ts, lat, lng, accuracy_m, source)
             VALUES ('shift-1', ?, 37.77, -122.41, 5, 'gps')`
        ).run(now);

        const response = await app.inject({
            method: 'GET',
            url: '/overlay/data'
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.shiftActive).toBe(true);
        expect(body.metrics.rides).toBe(2);
        expect(body.metrics.earnings_cents).toBe(2800);
        expect(body.metrics.tips_cents).toBe(300);
        expect(body.lastRide.id).toBe('ride-1');
        expect(body.path.length).toBe(1);
    });

    it('prefers active ride as lastRide when one exists', async () => {
        const db = getDb();
        const startedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        db.prepare(
            `INSERT INTO shifts (id, started_at, earnings_cents, tips_cents, distance_miles, ride_count)
             VALUES ('shift-2', ?, 1000, 0, 5, 1)`
        ).run(startedAt);

        // Completed ride earlier
        const earlier = new Date(Date.now() - 20 * 60 * 1000).toISOString();
        db.prepare(
            `INSERT INTO rides (id, shift_id, status, started_at, ended_at, gross_cents, tip_cents, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
             VALUES ('ride-complete', 'shift-2', 'completed', ?, ?, 1500, 200, 37.70, -122.40, 37.71, -122.41)`
        ).run(earlier, earlier);

        // Active ride later
        const activeStart = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        db.prepare(
            `INSERT INTO rides (id, shift_id, status, started_at, pickup_at, pickup_lat, pickup_lng)
             VALUES ('ride-active', 'shift-2', 'in_progress', ?, ?, 37.72, -122.42)`
        ).run(activeStart, activeStart);

        db.prepare(
            `INSERT INTO location_pings (shift_id, ts, lat, lng, accuracy_m, source)
             VALUES ('shift-2', ?, 37.72, -122.42, 5, 'gps')`
        ).run(activeStart);

        const response = await app.inject({
            method: 'GET',
            url: '/overlay/data'
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.lastRide.id).toBe('ride-active');
        expect(body.markers.pickup).toEqual({ lat: 37.72, lng: -122.42 });
    });
});
