import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { build } from '../src/app.js';
import { closeDb } from '../src/db.js';
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

    it('serves overlay html with channel and token placeholders', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/overlay?channel=demo&token=abc123'
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.body).toContain('Rides');
        expect(response.body).toContain('demo');
        expect(response.body).toContain('Token');
    });

    it('returns 400 for invalid query', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/overlay?channel='
        });
        expect(response.statusCode).toBe(400);
    });
});
