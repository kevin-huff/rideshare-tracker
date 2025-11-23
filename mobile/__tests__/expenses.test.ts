jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Lightweight in-memory mock for SQLite used in expense DB helpers
const mockRows = () => ({
  length: 0,
  item: (_idx: number) => ({}),
});

let mockExpenseStore: any[] = [];
let mockUserVersion = 0;

jest.mock('react-native-sqlite-storage', () => {
  const executeSql = async (sql: string, params: any[] = []) => {
    if (sql.startsWith('PRAGMA user_version')) {
      return [{ rows: { length: 1, item: () => ({ user_version: mockUserVersion }) } }];
    }
    if (sql.startsWith('PRAGMA user_version =')) {
      mockUserVersion = parseInt(sql.split('=')[1]) || params[0] || mockUserVersion;
      return [{ rows: mockRows() }];
    }
    if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX') || sql.includes('PRAGMA foreign_keys')) {
      return [{ rows: mockRows() }];
    }
    if (sql.startsWith('INSERT INTO expenses')) {
      const [id, ts, category, amount_cents, note, receipt_base64, receipt_mime] = params;
      mockExpenseStore.push({
        id,
        ts,
        category,
        amount_cents,
        note,
        receipt_base64,
        receipt_mime,
        receipt_url: null,
        synced: 0,
      });
      return [{ rows: mockRows() }];
    }
    if (sql.startsWith('UPDATE expenses SET id = ?, synced = 1')) {
      const [newId, receiptUrl, oldId] = params;
      mockExpenseStore = mockExpenseStore.map((exp) =>
        exp.id === oldId ? { ...exp, id: newId, receipt_url: receiptUrl, synced: 1, receipt_base64: null } : exp
      );
      return [{ rows: mockRows() }];
    }
    if (sql.startsWith('UPDATE expenses SET id = ? WHERE id = ?')) {
      const [newId, oldId] = params;
      mockExpenseStore = mockExpenseStore.map((exp) => (exp.id === oldId ? { ...exp, id: newId } : exp));
      return [{ rows: mockRows() }];
    }
    if (sql.startsWith('SELECT * FROM expenses WHERE id = ?')) {
      const target = mockExpenseStore.find((exp) => exp.id === params[0]);
      return [
        {
          rows: {
            length: target ? 1 : 0,
            item: () => target,
          },
        },
      ];
    }
    if (sql.startsWith('SELECT * FROM expenses ORDER BY ts DESC')) {
      const limit = params[0] ?? mockExpenseStore.length;
      const rows = mockExpenseStore
        .slice()
        .sort((a, b) => (a.ts > b.ts ? -1 : 1))
        .slice(0, limit);
      return [
        {
          rows: {
            length: rows.length,
            item: (i: number) => rows[i],
          },
        },
      ];
    }
    return [{ rows: mockRows() }];
  };

  return {
    openDatabase: jest.fn(async () => ({
      executeSql,
      transaction: async (cb: any) => cb({ executeSql }),
      close: jest.fn(),
    })),
    DEBUG: jest.fn(),
    enablePromise: jest.fn(),
  };
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { initDatabase, closeDatabase, getDatabase } from '../src/db';
import * as ExpenseDB from '../src/db/expenses';

describe('Expenses DB', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  beforeEach(async () => {
    mockExpenseStore = [];
    mockUserVersion = 0;
    const db = getDatabase();
    await db.executeSql('DELETE FROM expenses');
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('creates and marks an expense as synced', async () => {
    const expense = await ExpenseDB.createExpense({
      category: 'fuel',
      amount_cents: 1500,
      note: 'test',
    });
    expect(expense.synced).toBe(false);

    await ExpenseDB.markExpenseSynced(expense.id, 'server-expense', 'http://example.com/receipt.jpg');
    const dbExpense = await ExpenseDB.getExpenseById('server-expense');
    expect(dbExpense?.synced).toBe(true);
    expect(dbExpense?.receipt_url).toContain('http://example.com/receipt.jpg');
  });
});
