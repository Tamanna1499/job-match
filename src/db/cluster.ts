import { existsSync } from 'node:fs';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { DATABASE } from '../config/database.js';

/**
 * Starts a real PostgreSQL server from `node_modules` and keeps a handle on it.
 *
 * Real Postgres means real SQL, real constraints and real migrations, while setup stays
 * `npm install && npm start` with nothing installed on the host.
 *
 * Two failures from the previous project are pre-empted here, because both cost an
 * afternoon before they were understood:
 *
 * 1. `initdb` refuses to run over an existing cluster, so a plain restart failed. Every
 *    run during development happened to follow a delete, which hid it. `initialise()` is
 *    now called only when the data directory has no cluster in it.
 * 2. A start failure surfaced as an empty error, because Postgres reports what went wrong
 *    on its own stderr rather than through the rejected promise. That output is captured
 *    and attached to the error thrown here.
 */

let cluster: EmbeddedPostgres | undefined;

/** A cluster that has been initialised leaves a PG_VERSION file at the top of its data directory. */
function alreadyInitialised(directory: string): boolean {
  return existsSync(join(directory, 'PG_VERSION'));
}

/**
 * Postgres does not log its own password, but this output is attached to thrown errors
 * and read by humans, so it is scrubbed rather than trusted.
 */
function redact(message: string): string {
  return DATABASE.password.length > 0
    ? message.replaceAll(DATABASE.password, '[redacted]')
    : message;
}

export async function startCluster(): Promise<void> {
  if (cluster !== undefined) return;

  const output: string[] = [];
  const record = (message: string | Error | unknown): void => {
    const text = message instanceof Error ? message.message : String(message);
    output.push(redact(text.trimEnd()));
  };

  const postgres = new EmbeddedPostgres({
    databaseDir: DATABASE.directory,
    port: DATABASE.port,
    user: DATABASE.user,
    password: DATABASE.password,
    authMethod: 'scram-sha-256',
    persistent: true,
    onLog: record,
    onError: record,
  });

  if (!alreadyInitialised(DATABASE.directory)) {
    await postgres.initialise();
  }

  try {
    await postgres.start();
  } catch (error) {
    const reported = error instanceof Error ? error.message : String(error);
    const detail = output.length > 0 ? output.join('\n') : '(postgres produced no output)';
    throw new Error(
      `Could not start the embedded cluster on port ${String(DATABASE.port)}: ${redact(reported)}\n${detail}`,
      { cause: error },
    );
  }

  cluster = postgres;
}

export async function stopCluster(): Promise<void> {
  if (cluster === undefined) return;
  const stopping = cluster;
  cluster = undefined;
  await stopping.stop();
}
