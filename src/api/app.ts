import Fastify, { type FastifyInstance } from 'fastify';
import type { HealthRepository } from '../repository/types.js';

/** Routes are registered against an already migrated database. */
export function createApp(health: HealthRepository): FastifyInstance {
  const app = Fastify({
    logger: true,
    requestTimeout: 10_000,
    connectionTimeout: 10_000,
    forceCloseConnections: 'idle',
  });

  app.get('/health', async (request, reply) => {
    const available = await health.check();
    if (!available) request.log.warn('database health check failed');
    return reply.code(available ? 200 : 503).send({ status: available ? 'ok' : 'unavailable' });
  });

  return app;
}
