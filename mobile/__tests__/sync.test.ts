jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-sqlite-storage', () => ({
    DEBUG: () => {},
    enablePromise: () => {},
    openDatabase: jest.fn().mockResolvedValue({
        executeSql: jest.fn(),
        transaction: jest.fn(async (fn: any) =>
            fn({
                executeSql: jest.fn(),
            })
        ),
        close: jest.fn(),
    }),
}));

jest.mock('react-native', () => ({
    AppState: {
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    NativeModules: {},
}));

import { __test } from '../src/api/sync';
import { resolveServerId } from '../src/db/util';
import { updateQueuedRequest } from '../src/db/queue';
import { updateShiftId, markShiftSynced } from '../src/db/shifts';
import { updateRideId, markRideSynced } from '../src/db/rides';

jest.mock('../src/db/util', () => ({
    resolveServerId: jest.fn(),
}));

jest.mock('../src/db/queue', () => ({
    updateQueuedRequest: jest.fn(),
}));

jest.mock('../src/db/shifts', () => ({
    updateShiftId: jest.fn(),
    markShiftSynced: jest.fn(),
}));

jest.mock('../src/db/rides', () => ({
    updateRideId: jest.fn(),
    markRideSynced: jest.fn(),
}));

describe('sync helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rewrites queued requests using mapped server IDs', async () => {
        (resolveServerId as jest.Mock).mockImplementation((id: string) => {
            if (id === 'local-ride') return Promise.resolve('server-ride');
            if (id === 'local-shift') return Promise.resolve('server-shift');
            return Promise.resolve(null);
        });

        const request = {
            id: 1,
            url: '/v1/rides/local-ride/end',
            body: JSON.stringify({ ride_id: 'local-ride', shift_id: 'local-shift' }),
            meta: JSON.stringify({ rideId: 'local-ride', shiftId: 'local-shift' }),
        };

        const result = await __test.rewriteRequestIdsIfNeeded(request, JSON.parse(request.meta!));

        expect(result.url).toBe('/v1/rides/server-ride/end');
        expect(JSON.parse(result.body!)).toEqual({ ride_id: 'server-ride', shift_id: 'server-shift' });
        expect(JSON.parse(result.meta!)).toEqual({ rideId: 'server-ride', shiftId: 'server-shift' });

        expect(updateQueuedRequest).toHaveBeenCalledWith(1, {
            url: '/v1/rides/server-ride/end',
            body: result.body,
            meta: result.meta,
        });
    });

    it('maps shift IDs on successful POST responses', async () => {
        const response = {
            headers: { get: jest.fn(() => 'application/json') },
            json: jest.fn().mockResolvedValue({ id: 'server-shift' }),
        };

        await __test.handlePostSuccessMappings(
            { type: 'shift_create', localId: 'local-shift' },
            response as any
        );

        expect(updateShiftId).toHaveBeenCalledWith('local-shift', 'server-shift');
        expect(markShiftSynced).toHaveBeenCalledWith('server-shift');
    });

    it('maps ride IDs on successful POST responses', async () => {
        const response = {
            headers: { get: jest.fn(() => 'application/json') },
            json: jest.fn().mockResolvedValue({ id: 'server-ride' }),
        };

        await __test.handlePostSuccessMappings(
            { type: 'ride_create', localId: 'local-ride' },
            response as any
        );

        expect(updateRideId).toHaveBeenCalledWith('local-ride', 'server-ride');
        expect(markRideSynced).toHaveBeenCalledWith('server-ride');
    });
});
