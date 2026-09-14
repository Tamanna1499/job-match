/**
 * Where the embedded cluster lives and how to reach it.
 *
 * Port 5434 rather than the default 5432 so this project cannot collide with another
 * Postgres already running on the machine — the containment rule applied to a port number.
 *
 * The credentials are for a cluster that exists only inside this project directory and
 * listens on localhost. They are defaults for local development, not secrets; every one of
 * them can still be overridden by the environment.
 */
export const DATABASE = {
  directory: process.env.PGDATA_DIR ?? '.pgdata',
  port: Number(process.env.PGPORT ?? 5434),
  user: process.env.PGUSER ?? 'jobmatch',
  password: process.env.PGPASSWORD ?? 'jobmatch-local',
  database: process.env.PGDATABASE ?? 'jobmatch',
} as const;
