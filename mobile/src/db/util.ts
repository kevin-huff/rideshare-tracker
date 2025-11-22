import SQLite from 'react-native-sqlite-storage';
import { getDatabase } from './index';

/**
 * Persist a local->server ID mapping for later rewrites.
 */
export async function saveIdMapping(
    entity: 'shift' | 'ride',
    localId: string,
    serverId: string,
    tx?: SQLite.Transaction
): Promise<void> {
    const db = getDatabase();
    const executor = tx ?? db;

    await executor.executeSql(
        'INSERT OR REPLACE INTO id_mappings (local_id, server_id, entity) VALUES (?, ?, ?)',
        [localId, serverId, entity]
    );
}

/**
 * Resolve a server ID for a given local ID if it exists.
 */
export async function resolveServerId(localId: string): Promise<string | null> {
    const db = getDatabase();
    const [result] = await db.executeSql(
        'SELECT server_id FROM id_mappings WHERE local_id = ? LIMIT 1',
        [localId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows.item(0).server_id as string;
}
