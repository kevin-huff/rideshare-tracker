import BackgroundGeolocation from '@mauron85/react-native-background-geolocation';
import * as LocationService from '../src/services/LocationService';
import { savePing } from '../src/db/location';

jest.mock('@mauron85/react-native-background-geolocation', () => {
    const listeners: Record<string, Function[]> = { location: [], error: [] };
    return {
        HIGH_ACCURACY: 0,
        MEDIUM_ACCURACY: 1,
        ACTIVITY_PROVIDER: 1,
        on: jest.fn((event: string, cb: Function) => listeners[event]?.push(cb)),
        removeAllListeners: jest.fn(() => {
            Object.keys(listeners).forEach((k) => (listeners[k] = []));
        }),
        configure: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        startTask: jest.fn((cb: Function) => cb(1)),
        endTask: jest.fn(),
        __listeners: listeners,
    };
});

jest.mock('react-native', () => ({
    Platform: { OS: 'android' },
}));

jest.mock('../src/db/location', () => ({
    savePing: jest.fn(),
}));

describe('LocationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (BackgroundGeolocation as any).__listeners.location = [];
    });

    it('configures ride mode with high accuracy and saves pings', async () => {
        await LocationService.start('shift-1', 'ride-1', 'ride');
        const listeners = (BackgroundGeolocation as any).__listeners.location;
        expect(BackgroundGeolocation.configure).toHaveBeenCalled();
        expect(BackgroundGeolocation.start).toHaveBeenCalled();
        expect(listeners.length).toBe(1);

        const locationCb = listeners[0];
        await locationCb({
            latitude: 1,
            longitude: 2,
            accuracy: 3,
            speed: 4,
            bearing: 5,
        });

        expect(savePing).toHaveBeenCalledWith('shift-1', 1, 2, 3, 'gps', 'ride-1', 4, 5);
    });

    it('switches mode and ride id via setMode', async () => {
        await LocationService.start('shift-1', undefined, 'waiting');
        LocationService.setMode('ride', 'ride-2');
        expect(BackgroundGeolocation.configure).toHaveBeenLastCalledWith(expect.objectContaining({ distanceFilter: 5 }));
    });

    it('stops and removes listeners', () => {
        LocationService.stop();
        expect(BackgroundGeolocation.removeAllListeners).toHaveBeenCalled();
        expect(BackgroundGeolocation.stop).toHaveBeenCalled();
    });
});
