import { lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Reserved for destructive integration tests; never inherit a developer's PG settings.
export const TEST_DATABASE_ENV = {
  PGDATA_DIR: fileURLToPath(new URL('../../.pgdata-test', import.meta.url)),
  PGPORT: '5435',
  PGDATABASE: 'jobmatch_test',
  PGUSER: 'jobmatch_test',
  PGPASSWORD: 'jobmatch-test-local',
  APP_PORT: '3108',
} as const;

export function assertTestDatabase(database: {
  readonly directory: string;
  readonly port: number;
  readonly database: string;
}): void {
  if (
    resolve(database.directory) !== TEST_DATABASE_ENV.PGDATA_DIR ||
    database.port !== Number(TEST_DATABASE_ENV.PGPORT) ||
    database.database !== TEST_DATABASE_ENV.PGDATABASE
  ) {
    throw new Error('Refusing integration tests outside the reserved test database');
  }

  // A correctly named directory must not redirect cleanup into another cluster.
  if (lstatSync(database.directory, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error('Refusing a symlink as the integration database directory');
  }
}
