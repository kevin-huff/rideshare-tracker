import AsyncStorage from '@react-native-async-storage/async-storage';
import * as API from '../src/api/client';

describe('API client retry logic', () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
        jest.resetAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('https://api.example.com'); // base url
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('device-token'); // token
        // @ts-ignore
        global.fetch = fetchMock;
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('retries on server errors and succeeds on third attempt', async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err', headers: { get: () => 'text/plain' } })
            .mockResolvedValueOnce({ ok: false, status: 502, text: async () => 'err', headers: { get: () => 'text/plain' } })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ id: 'shift-1', started_at: 'now' }),
            });

        const promise = API.startShift();
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(result.id).toBe('shift-1');
    });

    it('does not retry on 401', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => 'unauthorized',
            headers: { get: () => 'text/plain' },
        });

        await expect(API.startShift()).rejects.toThrow('HTTP 401');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native', () => ({
    Platform: { OS: 'android' },
}));
