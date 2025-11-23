import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ExpensesScreen } from '../src/screens/ExpensesScreen';
import { ThemeProvider } from '../src/theme';

jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mocks
jest.mock('react-native-image-picker', () => ({
    launchCamera: jest.fn(),
    launchImageLibrary: jest.fn(),
}));

jest.mock('../src/db/expenses', () => ({
    listExpenses: jest.fn(() => Promise.resolve([])),
    createExpense: jest.fn((data) => Promise.resolve({ ...data, id: 'local-id', ts: new Date().toISOString(), synced: false })),
    markExpenseSynced: jest.fn(),
    getExpenseById: jest.fn(),
}));

jest.mock('../src/db/queue', () => ({
    enqueueRequest: jest.fn(),
}));

jest.mock('../src/api/client', () => ({
    createExpense: jest.fn(() => Promise.resolve({ id: 'server-id', receipt_url: 'http://url' })),
}));

const mockOnClose = jest.fn();

describe('ExpensesScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly', async () => {
        const { getByText, getByPlaceholderText } = render(
            <ThemeProvider>
                <ExpensesScreen onClose={mockOnClose} />
            </ThemeProvider>
        );

        expect(getByText('Expenses')).toBeTruthy();
        expect(getByPlaceholderText('Fuel, Parking, Toll...')).toBeTruthy();
        expect(getByPlaceholderText('$0.00')).toBeTruthy();
    });

    it('validates amount input', async () => {
        const { getByText, getByPlaceholderText } = render(
            <ThemeProvider>
                <ExpensesScreen onClose={mockOnClose} />
            </ThemeProvider>
        );

        const addButton = getByText('Add Expense');
        fireEvent.press(addButton);

        // Alert would show, but we can't easily assert Alert.alert in RNTL without mocking Alert
        // However, we can check that createExpense wasn't called
        const { createExpense } = require('../src/db/expenses');
        expect(createExpense).not.toHaveBeenCalled();
    });

    it('adds an expense successfully', async () => {
        const { getByText, getByPlaceholderText } = render(
            <ThemeProvider>
                <ExpensesScreen onClose={mockOnClose} />
            </ThemeProvider>
        );

        fireEvent.changeText(getByPlaceholderText('Fuel, Parking, Toll...'), 'Lunch');
        fireEvent.changeText(getByPlaceholderText('$0.00'), '15.50');
        fireEvent.changeText(getByPlaceholderText('Optional details'), 'Burger');

        fireEvent.press(getByText('Add Expense'));

        await waitFor(() => {
            const { createExpense } = require('../src/db/expenses');
            expect(createExpense).toHaveBeenCalledWith(expect.objectContaining({
                category: 'Lunch',
                amount_cents: 1550,
                note: 'Burger',
            }));
        });
    });
});
