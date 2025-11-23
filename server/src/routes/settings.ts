import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireToken } from '../auth.js';
import { getSettings, updateSettings, overlayThemes } from '../settings.js';
import { overlayEmitter } from './overlay.js';

const themeOptions = Object.keys(overlayThemes) as [string, ...string[]];

const UpdateSettingsSchema = z.object({
    overlay_privacy_radius_m: z.number().int().min(0).max(5000).optional(),
    overlay_hide_location: z.boolean().optional(),
    overlay_theme: z.enum(themeOptions as [string, ...string[]]).optional()
});

export async function settingsRoutes(fastify: FastifyInstance) {
    fastify.get('/v1/settings', async (request, reply) => {
        if (!requireToken(request, reply)) {
            return;
        }
        const settings = getSettings();
        reply.send({
            overlay_privacy_radius_m: settings.overlay_privacy_radius_m,
            overlay_hide_location: Boolean(settings.overlay_hide_location),
            overlay_theme: settings.overlay_theme
        });
    });

    fastify.patch('/v1/settings', async (request, reply) => {
        if (!requireToken(request, reply)) {
            return;
        }

        const parsed = UpdateSettingsSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid request body' });
        }

        const settings = updateSettings({
            overlay_privacy_radius_m: parsed.data.overlay_privacy_radius_m,
            overlay_hide_location: parsed.data.overlay_hide_location !== undefined
                ? parsed.data.overlay_hide_location ? 1 : 0
                : undefined,
            overlay_theme: parsed.data.overlay_theme
        });

        overlayEmitter.emit('update');

        reply.send({
            overlay_privacy_radius_m: settings.overlay_privacy_radius_m,
            overlay_hide_location: Boolean(settings.overlay_hide_location),
            overlay_theme: settings.overlay_theme
        });
    });
}
