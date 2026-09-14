export class NotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}
