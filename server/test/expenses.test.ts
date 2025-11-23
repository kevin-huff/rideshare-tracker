import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { build } from '../src/app.js';
import { closeDb, getDb } from '../src/db.js';

const TEST_DB_PATH = path.join(__dirname, 'expenses-test.db');
const RECEIPTS_DIR = path.join(__dirname, 'receipts');
const TOKEN = 'test-token';
const authHeaders = { authorization: `Bearer ${TOKEN}` };

describe('Expense Routes', () => {
    let app: any;

    beforeEach(async () => {
        process.env.DEVICE_TOKEN = TOKEN;
        process.env.RECEIPTS_DIR = RECEIPTS_DIR;
        if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
        if (fs.existsSync(RECEIPTS_DIR)) fs.rmSync(RECEIPTS_DIR, { recursive: true, force: true });
        app = build(TEST_DB_PATH);
    });

    afterEach(async () => {
        await app.close();
        closeDb();
        if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
        if (fs.existsSync(RECEIPTS_DIR)) fs.rmSync(RECEIPTS_DIR, { recursive: true, force: true });
        delete process.env.RECEIPTS_DIR;
    });

    it('rejects unauthenticated expense creation', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/v1/expenses',
            payload: { category: 'tolls', amount_cents: 500 }
        });
        expect(response.statusCode).toBe(401);
    });

    it('creates an expense with optional receipt and lists it', async () => {
        const receiptBase64 = Buffer.from('sample').toString('base64');
        const create = await app.inject({
            method: 'POST',
            url: '/v1/expenses',
            headers: authHeaders,
            payload: {
                ts: '2024-01-01T00:00:00.000Z',
                category: 'parking',
                amount_cents: 1200,
                note: 'airport',
                receipt_base64: receiptBase64,
                receipt_mime: 'image/png'
            }
        });

        expect(create.statusCode).toBe(200);
        const body = JSON.parse(create.body);
        expect(body).toHaveProperty('id');
        expect(body.receipt_url).toContain('/receipts/');

        const db = getDb();
        const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(body.id);
        expect(row.category).toBe('parking');
        expect(row.amount_cents).toBe(1200);
        expect(row.receipt_url).toBe(body.receipt_url);

        // Receipt written to disk
        const filename = path.basename(body.receipt_url);
        expect(fs.existsSync(path.join(RECEIPTS_DIR, filename))).toBe(true);

        const list = await app.inject({
            method: 'GET',
            url: '/v1/expenses?limit=10',
            headers: authHeaders
        });

        expect(list.statusCode).toBe(200);
        const listBody = JSON.parse(list.body);
        expect(listBody.expenses).toHaveLength(1);
        expect(listBody.expenses[0].category).toBe('parking');
    });
});
