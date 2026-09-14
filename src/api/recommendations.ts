import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import type { CandidateRepository, JobRepository } from '../repository/types.js';
import { recommendJobs } from '../service/recommendations.js';
import { recommendationParams, recommendationQuery } from './schemas.js';

export function registerRecommendationRoutes(
  app: FastifyInstance,
  candidates: CandidateRepository,
  jobs: JobRepository,
): void {
  app.get<{
    Params: z.infer<typeof recommendationParams>;
    Querystring: z.infer<typeof recommendationQuery>;
  }>(
    '/candidates/:id/recommendations',
    { schema: { params: recommendationParams, querystring: recommendationQuery } },
    async (request) => recommendJobs(request.params.id, request.query.limit, candidates, jobs),
  );
}
