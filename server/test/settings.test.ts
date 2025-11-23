import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { build } from '../src/app.js';
import { closeDb, getDb } from '../src/db.js';

const TEST_DB_PATH = path.join(__dirname, 'settings-test.db');
const TOKEN = 'test-token';
const authHeaders = { authorization: `Bearer ${TOKEN}` };

describe('Settings Routes', () => {
    let app: any;

    beforeEach(async () => {
        process.env.DEVICE_TOKEN = TOKEN;
        if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
        app = build(TEST_DB_PATH);
    });

    afterEach(async () => {
        await app.close();
        closeDb();
        if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    });

    it('requires auth for settings', async () => {
        const response = await app.inject({ method: 'GET', url: '/v1/settings' });
        expect(response.statusCode).toBe(401);
    });

    it('updates privacy radius and theme', async () => {
        const update = await app.inject({
            method: 'PATCH',
            url: '/v1/settings',
            headers: authHeaders,
            payload: { overlay_privacy_radius_m: 250, overlay_hide_location: true, overlay_theme: 'ember' }
        });

        expect(update.statusCode).toBe(200);
        const body = JSON.parse(update.body);
        expect(body.overlay_privacy_radius_m).toBe(250);
        expect(body.overlay_hide_location).toBe(true);
        expect(body.overlay_theme).toBe('ember');

        const db = getDb();
        const row = db.prepare('SELECT overlay_privacy_radius_m, overlay_hide_location, overlay_theme FROM settings WHERE id = 1').get();
        expect(row.overlay_privacy_radius_m).toBe(250);
        expect(row.overlay_hide_location).toBe(1);
        expect(row.overlay_theme).toBe('ember');
    });

    it('rejects invalid payloads', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/v1/settings',
            headers: authHeaders,
            payload: { overlay_privacy_radius_m: -5 }
        });
        expect(response.statusCode).toBe(400);
    });
});
