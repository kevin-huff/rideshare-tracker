import { describe, it, expect } from 'vitest';
import { build } from '../src/app.js';

describe('Shift Routes', () => {
    const app = build();

    it('POST /v1/shifts should create a new shift', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/v1/shifts'
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('started_at');
    });
});
