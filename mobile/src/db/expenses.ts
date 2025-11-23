import { getDatabase } from './index';
import { Expense, CreateExpenseRequest } from '../types';
import uuid from 'react-native-uuid';
import SQLite from 'react-native-sqlite-storage';
import { saveIdMapping } from './util';

export async function createExpense(payload: CreateExpenseRequest): Promise<Expense> {
    const db = getDatabase();
    const id = uuid.v4() as string;
    const ts = payload.ts ?? new Date().toISOString();

    await db.executeSql(
        `INSERT INTO expenses (id, ts, category, amount_cents, note, receipt_base64, receipt_mime, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
            id,
            ts,
            payload.category,
            payload.amount_cents,
            payload.note ?? null,
            payload.receipt_base64 ?? null,
            payload.receipt_mime ?? null,
        ]
    );

    return {
        id,
        ts,
        category: payload.category,
        amount_cents: payload.amount_cents,
        note: payload.note ?? null,
        receipt_base64: payload.receipt_base64 ?? null,
        receipt_mime: payload.receipt_mime ?? null,
        receipt_url: null,
        synced: false,
    };
}

export async function listExpenses(limit: number = 50): Promise<Expense[]> {
    const db = getDatabase();
    const [result] = await db.executeSql(
        'SELECT * FROM expenses ORDER BY ts DESC LIMIT ?',
        [limit]
    );

    const expenses: Expense[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        expenses.push(rowToExpense(result.rows.item(i)));
    }
    return expenses;
}

export async function markExpenseSynced(
    localId: string,
    serverId?: string,
    receiptUrl?: string | null,
    tx?: SQLite.Transaction
): Promise<void> {
    const db = getDatabase();
    const executor = tx ?? db;
    const targetId = serverId ?? localId;

    await executor.executeSql(
        'UPDATE expenses SET id = ?, synced = 1, receipt_url = COALESCE(?, receipt_url), receipt_base64 = NULL WHERE id = ?',
        [targetId, receiptUrl ?? null, localId]
    );

    if (serverId && serverId !== localId) {
        await saveIdMapping('expense', localId, serverId, executor);
    }
}

export async function updateExpenseId(oldId: string, newId: string): Promise<void> {
    const db = getDatabase();
    await db.transaction(async (tx) => {
        await tx.executeSql('UPDATE expenses SET id = ? WHERE id = ?', [newId, oldId]);
        await saveIdMapping('expense', oldId, newId, tx);
    });
}

export async function getExpenseById(id: string): Promise<Expense | null> {
    const db = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM expenses WHERE id = ? LIMIT 1', [id]);
    if (result.rows.length === 0) {
        return null;
    }
    return rowToExpense(result.rows.item(0));
}

function rowToExpense(row: any): Expense {
    return {
        id: row.id,
        ts: row.ts,
        category: row.category,
        amount_cents: row.amount_cents,
        note: row.note,
        receipt_base64: row.receipt_base64,
        receipt_mime: row.receipt_mime,
        receipt_url: row.receipt_url,
        synced: row.synced === 1,
    };
}
