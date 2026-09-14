import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import type { CandidateRepository } from '../repository/types.js';
import { candidateBody } from './schemas.js';

export function registerCandidateRoutes(
  app: FastifyInstance,
  candidates: CandidateRepository,
): void {
  app.post<{ Body: z.infer<typeof candidateBody> }>(
    '/candidates',
    { schema: { body: candidateBody } },
    async (request, reply) => reply.code(201).send(await candidates.create(request.body)),
  );
}
