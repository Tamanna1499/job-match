import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { NotFoundError } from '../domain/errors.js';

export function configureRequests(app: FastifyInstance): void {
  app.setValidatorCompiler(({ schema }) => {
    const validator = schema as z.ZodType;
    return (input) => {
      const result = validator.safeParse(input);
      return result.success ? { value: result.data } : { error: result.error };
    };
  });

  app.setErrorHandler((error, request, reply) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      ('validation' in error || ('statusCode' in error && error.statusCode === 400))
    ) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_REQUEST', message: 'Invalid request' } });
    }
    if (error instanceof NotFoundError) {
      return reply.code(404).send({ error: { code: error.code, message: error.message } });
    }
    request.log.error(
      {
        name: error instanceof Error ? error.name : 'UnknownError',
        stack: error instanceof Error ? error.stack?.split('\n').slice(1).join('\n') : undefined,
      },
      'request failed',
    );
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } }),
  );
}
