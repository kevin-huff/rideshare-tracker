import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db.js';
import { requireToken } from '../auth.js';

const CreateExpenseSchema = z.object({
    ts: z.string().datetime().optional(),
    category: z.string().min(1),
    amount_cents: z.number().int().positive(),
    note: z.string().max(500).optional(),
    receipt_base64: z.string().optional(),
    receipt_mime: z.string().optional()
});

const ListExpensesQuery = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().positive().max(500).optional()
});

function ensureReceiptsDir(): string {
    const dir = process.env.RECEIPTS_DIR || path.join(process.cwd(), 'receipts');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function persistReceipt(id: string, base64: string, mime?: string): string {
    const dir = ensureReceiptsDir();
    const [, dataPart] = base64.includes(',') ? base64.split(',') : [null, base64];
    const buffer = Buffer.from(dataPart, 'base64');
    const ext = mime?.includes('png')
        ? 'png'
        : mime?.includes('webp')
        ? 'webp'
        : 'jpg';
    const filename = `${id}.${ext}`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buffer);
    return `/receipts/${filename}`;
}

export async function expenseRoutes(fastify: FastifyInstance) {
    fastify.post('/v1/expenses', async (request, reply) => {
        if (!requireToken(request, reply)) {
            return;
        }

        const parsed = CreateExpenseSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid request body' });
        }

        const db = getDb();
        const id = randomUUID();
        const ts = parsed.data.ts ?? new Date().toISOString();
        let receiptUrl: string | null = null;

        if (parsed.data.receipt_base64) {
            try {
                receiptUrl = persistReceipt(id, parsed.data.receipt_base64, parsed.data.receipt_mime);
            } catch (err) {
                request.log.error({ err }, 'Failed to persist receipt');
                return reply.status(400).send({ error: 'Invalid receipt payload' });
            }
        }

        db.prepare(
            `INSERT INTO expenses (id, ts, category, amount_cents, note, receipt_url)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).run(id, ts, parsed.data.category, parsed.data.amount_cents, parsed.data.note ?? null, receiptUrl);

        return { id, ts, receipt_url: receiptUrl };
    });

    fastify.get('/v1/expenses', async (request, reply) => {
        if (!requireToken(request, reply)) {
            return;
        }

        const parsed = ListExpensesQuery.safeParse(request.query ?? {});
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid query' });
        }

        const db = getDb();
        const clauses: string[] = [];
        const params: any[] = [];

        if (parsed.data.from) {
            clauses.push('ts >= ?');
            params.push(parsed.data.from);
        }
        if (parsed.data.to) {
            clauses.push('ts <= ?');
            params.push(parsed.data.to);
        }

        const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
        const limit = parsed.data.limit ?? 50;

        const rows = db
            .prepare(
                `SELECT id, ts, category, amount_cents, note, receipt_url
                 FROM expenses
                 ${where}
                 ORDER BY ts DESC
                 LIMIT ?`
            )
            .all(...params, limit);

        reply.send({ expenses: rows });
    });
}
