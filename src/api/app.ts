import Fastify, { type FastifyInstance } from 'fastify';
import type { Repositories } from '../repository/types.js';
import { configureRequests } from './request.js';
import { registerCandidateRoutes } from './candidates.js';
import { registerJobRoutes } from './jobs.js';
import { registerRecommendationRoutes } from './recommendations.js';

/** Routes are registered against an already migrated database. */
export function createApp(repositories: Repositories): FastifyInstance {
  const app = Fastify({
    logger: true,
    requestTimeout: 10_000,
    connectionTimeout: 10_000,
    forceCloseConnections: 'idle',
  });

  configureRequests(app);

  app.get('/health', async (request, reply) => {
    const available = await repositories.health.check();
    if (!available) request.log.warn('database health check failed');
    return reply.code(available ? 200 : 503).send({ status: available ? 'ok' : 'unavailable' });
  });

  registerCandidateRoutes(app, repositories.candidates);
  registerJobRoutes(app, repositories.jobs);
  registerRecommendationRoutes(app, repositories.candidates, repositories.jobs);

  return app;
}
