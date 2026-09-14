import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import type { JobRepository } from '../repository/types.js';
import { jobBody } from './schemas.js';

export function registerJobRoutes(app: FastifyInstance, jobs: JobRepository): void {
  app.post<{ Body: z.infer<typeof jobBody> }>(
    '/jobs',
    { schema: { body: jobBody } },
    async (request, reply) => reply.code(201).send(await jobs.create(request.body)),
  );
}
