import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { build } from '../src/app.js';
import { closeDb } from '../src/db.js';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, 'test.db');
const TOKEN = 'test-token';
const authHeaders = { authorization: `Bearer ${TOKEN}` };

async function startShift(app: any) {
    const response = await app.inject({
        method: 'POST',
        url: '/v1/shifts',
        headers: authHeaders,
        payload: {}
    });
    return JSON.parse(response.body);
}

describe('Shift Routes', () => {
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

    it('POST /v1/shifts should require authorization', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/v1/shifts'
        });
        expect(response.statusCode).toBe(401);
    });

    it('POST /v1/shifts should reject invalid tokens', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/v1/shifts',
            headers: { authorization: 'Bearer wrong-token' }
        });
        expect(response.statusCode).toBe(401);
    });

    it('POST /v1/shifts should create a new shift with valid token', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/v1/shifts',
            headers: authHeaders,
            payload: {}
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('started_at');
    });

    it('POST /v1/shifts should fail if a shift is already active', async () => {
        await startShift(app);

        const response = await app.inject({
            method: 'POST',
            url: '/v1/shifts',
            headers: authHeaders,
            payload: {}
        });

        expect(response.statusCode).toBe(409);
    });

    it('PATCH /v1/shifts/:id/end should end an active shift', async () => {
        const started = await startShift(app);

        const response = await app.inject({
            method: 'PATCH',
            url: `/v1/shifts/${started.id}/end`,
            headers: authHeaders
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('ended_at');

        const secondShift = await app.inject({
            method: 'POST',
            url: '/v1/shifts',
            headers: authHeaders,
            payload: {}
        });
        expect(secondShift.statusCode).toBe(200);
    });

    it('PATCH /v1/shifts/:id/end should 404 for unknown shift', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: `/v1/shifts/00000000-0000-0000-0000-000000000000/end`,
            headers: authHeaders
        });
        expect(response.statusCode).toBe(404);
    });

    it('PATCH /v1/shifts/:id/end should 409 if shift already ended', async () => {
        const started = await startShift(app);
        await app.inject({
            method: 'PATCH',
            url: `/v1/shifts/${started.id}/end`,
            headers: authHeaders
        });

        const response = await app.inject({
            method: 'PATCH',
            url: `/v1/shifts/${started.id}/end`,
            headers: authHeaders
        });

        expect(response.statusCode).toBe(409);
    });
});
