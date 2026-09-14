import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Logger } from '../domain/types.js';
import { DATABASE } from '../config/database.js';
import * as schema from './schema.js';

/**
 * Owns the connection pool and brings the database to a usable state.
 *
 * `connect()` is the only way in, and it does not resolve until migrations have applied.
 * The server awaits it before binding a port, so there is no window in which the API is
 * accepting requests against a schema that does not exist yet.
 */

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let database: Database | undefined;

function connectionString(databaseName: string): string {
  const { user, password, port } = DATABASE;
  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgres://${credentials}@localhost:${String(port)}/${databaseName}`;
}

/**
 * The cluster starts with only the built-in `postgres` database, so the application's own
 * database is created on first run. `CREATE DATABASE` cannot run inside a transaction and
 * has no `IF NOT EXISTS`, hence the check-then-create.
 */
async function ensureDatabaseExists(logger: Logger): Promise<void> {
  const admin = new Pool({ connectionString: connectionString('postgres'), max: 1 });
  admin.on('error', (error) => {
    logger.error(`admin pool error: ${error.message}`);
  });

  try {
    const found = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      DATABASE.database,
    ]);
    if (found.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${DATABASE.database}"`);
    }
  } finally {
    await admin.end();
  }
}

export async function connect(logger: Logger): Promise<Database> {
  if (database !== undefined) return database;

  await ensureDatabaseExists(logger);

  const created = new Pool({ connectionString: connectionString(DATABASE.database) });

  /**
   * An idle client that dies — a cluster restart, a dropped socket — emits `error` on the
   * pool. Without a listener Node treats that as unhandled and takes the whole process
   * down, in the middle of whatever unrelated request happened to be in flight.
   *
   * Only the message is logged. Logging the error object itself prints the whole
   * connection configuration, password included.
   */
  created.on('error', (error) => {
    logger.error(`database pool error: ${error.message}`);
  });

  const instance = drizzle(created, { schema });
  await migrate(instance, { migrationsFolder: './drizzle' });

  pool = created;
  database = instance;
  return instance;
}

export async function disconnect(): Promise<void> {
  const closing = pool;
  pool = undefined;
  database = undefined;
  if (closing !== undefined) await closing.end();
}
