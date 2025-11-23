import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import Button from '../components/Button';
import { useTheme, Theme } from '../theme';
import { Expense, CreateExpenseRequest } from '../types';
import * as ExpenseDB from '../db/expenses';
import { enqueueRequest } from '../db/queue';
import * as API from '../api/client';

interface Props {
    onClose: () => void;
}

type ReceiptState = {
    base64: string;
    mime?: string;
    uri?: string;
    name?: string;
} | null;

export function ExpensesScreen({ onClose }: Props) {
    const { theme } = useTheme();
    const styles = getStyles(theme);
    const [category, setCategory] = useState('Fuel');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(false);
    const [receipt, setReceipt] = useState<ReceiptState>(null);

    useEffect(() => {
        (async () => {
            const rows = await ExpenseDB.listExpenses();
            setExpenses(rows);
        })();
    }, []);

    const handleAdd = async () => {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) {
            Alert.alert('Invalid amount', 'Enter a valid expense amount.');
            return;
        }
        setLoading(true);
        const cents = Math.round(parsed * 100);
        const payload: CreateExpenseRequest = {
            category: category.trim() || 'General',
            amount_cents: cents,
            note: note.trim().length ? note.trim() : undefined,
            receipt_base64: receipt?.base64,
            receipt_mime: receipt?.mime,
        };

        try {
            const local = await ExpenseDB.createExpense(payload);
            setExpenses((prev) => [local, ...prev]);
            setAmount('');
            setNote('');
            setReceipt(null);

            try {
                const res = await API.createExpense(payload);
                await ExpenseDB.markExpenseSynced(local.id, res.id, res.receipt_url ?? null);
                const refreshed = await ExpenseDB.getExpenseById(res.id ?? local.id);
                if (refreshed) {
                    setExpenses((prev) => [refreshed, ...prev.filter((e) => e.id !== local.id)]);
                }
            } catch (err) {
                await enqueueRequest('POST', '/v1/expenses', payload, {
                    type: 'expense_create',
                    localId: local.id,
                });
                Alert.alert('Saved offline', 'Expense will sync when connection returns.');
            }
        } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save expense');
        } finally {
            setLoading(false);
        }
    };

    const handleReceipt = async (from: 'camera' | 'library') => {
        const picker = from === 'camera' ? launchCamera : launchImageLibrary;
        const result = await picker({
            mediaType: 'photo',
            includeBase64: true,
            quality: 0.7,
        });
        if (result.didCancel) return;
        if (result.errorCode) {
            Alert.alert('Error', result.errorMessage || 'Failed to get image');
            return;
        }
        const asset: Asset | undefined = result.assets?.[0];
        if (!asset?.base64) {
            Alert.alert('Error', 'No image data returned');
            return;
        }
        setReceipt({
            base64: asset.base64,
            mime: asset.type ?? 'image/jpeg',
            uri: asset.uri,
            name: asset.fileName,
        });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Expenses</Text>
            <View style={styles.form}>
                <Text style={styles.label}>Category</Text>
                <TextInput
                    style={styles.input}
                    value={category}
                    onChangeText={setCategory}
                    placeholder="Fuel, Parking, Toll..."
                    placeholderTextColor={theme.muted}
                />
                <Text style={styles.label}>Amount</Text>
                <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="$0.00"
                    placeholderTextColor={theme.muted}
                />
                <Text style={styles.label}>Note</Text>
                <TextInput
                    style={[styles.input, { minHeight: 60 }]}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Optional details"
                    placeholderTextColor={theme.muted}
                    multiline
                />

                <View style={styles.receiptRow}>
                    <Button title="Camera Receipt" onPress={() => handleReceipt('camera')} variant="secondary" />
                    <Button title="Gallery" onPress={() => handleReceipt('library')} variant="secondary" />
                </View>
                {receipt ? (
                    <View style={styles.receiptPreview}>
                        <Text style={styles.hint}>Receipt attached {receipt.name ? `(${receipt.name})` : ''}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {receipt.uri ? (
                                <Image
                                    source={{ uri: receipt.uri.startsWith('data:') ? receipt.uri : `data:${receipt.mime};base64,${receipt.base64}` }}
                                    style={styles.receiptImage}
                                />
                            ) : null}
                            <Button title="Remove" onPress={() => setReceipt(null)} variant="secondary" />
                        </View>
                    </View>
                ) : null}

                <Button title="Add Expense" onPress={handleAdd} loading={loading} />
                <Button title="Close" onPress={onClose} variant="secondary" style={{ marginTop: 8 }} />
            </View>

            <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 120 }}>
                {expenses.map((exp) => (
                    <View key={exp.id} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>{exp.category}</Text>
                            <Text style={styles.cardAmount}>${(exp.amount_cents / 100).toFixed(2)}</Text>
                        </View>
                        <Text style={styles.cardMeta}>{new Date(exp.ts).toLocaleString()}</Text>
                        {exp.note ? <Text style={styles.cardNote}>{exp.note}</Text> : null}
                        <View style={styles.cardFooter}>
                            <Text style={[styles.badge, { backgroundColor: exp.synced ? theme.success : theme.border }]}>
                                {exp.synced ? 'Synced' : 'Pending'}
                            </Text>
                            {exp.receipt_url || exp.receipt_base64 ? (
                                <Text style={styles.hint}>📎 Receipt attached</Text>
                            ) : null}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const getStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
        padding: 16,
    },
    title: {
        color: theme.text,
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 12,
    },
    form: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 12,
        gap: 8,
    },
    label: {
        color: theme.muted,
        fontSize: 13,
    },
    input: {
        backgroundColor: theme.inputBackground,
        color: theme.text,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: theme.border,
    },
    receiptRow: {
        flexDirection: 'row',
        gap: 8,
        marginVertical: 4,
    },
    receiptPreview: {
        backgroundColor: theme.surfaceAlt,
        padding: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 8,
    },
    receiptImage: {
        width: 48,
        height: 48,
        borderRadius: 8,
    },
    list: {
        flex: 1,
    },
    card: {
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardTitle: {
        color: theme.text,
        fontWeight: '700',
        fontSize: 16,
    },
    cardAmount: {
        color: theme.accent,
        fontWeight: '800',
        fontSize: 16,
    },
    cardMeta: {
        color: theme.muted,
        fontSize: 12,
        marginTop: 2,
    },
    cardNote: {
        color: theme.text,
        marginTop: 6,
    },
    cardFooter: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    badge: {
        color: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        overflow: 'hidden',
        fontSize: 12,
    },
    hint: {
        color: theme.muted,
        fontSize: 12,
    },
});

export default ExpensesScreen;
