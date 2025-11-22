import { FastifyReply, FastifyRequest } from 'fastify';

export function requireToken(request: FastifyRequest, reply: FastifyReply): boolean {
    const configuredToken = process.env.DEVICE_TOKEN;
    if (!configuredToken) {
        request.log.error('DEVICE_TOKEN not configured');
        reply.status(500).send({ error: 'Server misconfigured' });
        return false;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({ error: 'Unauthorized' });
        return false;
    }

    const token = authHeader.split(' ')[1];
    if (token !== configuredToken) {
        reply.status(401).send({ error: 'Unauthorized' });
        return false;
    }

    return true;
}
