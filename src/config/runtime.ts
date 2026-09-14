import { lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { DATABASE } from './database.js';

export interface RuntimeConfig {
  readonly port: number;
  readonly host: '127.0.0.1';
}

function validPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}

function insideProject(path: string, project: string): boolean {
  const fromProject = relative(project, path);
  return (
    fromProject === '' ||
    (fromProject !== '..' && !fromProject.startsWith(`..${sep}`) && !isAbsolute(fromProject))
  );
}

/** Reject configuration that would create a database outside this project. */
export function validateRuntimeConfig(
  database = DATABASE,
  apiPort = Number(process.env.APP_PORT ?? 3107),
): RuntimeConfig {
  if (!validPort(database.port)) throw new Error('PGPORT must be an integer from 1024 to 65535');
  if (!validPort(apiPort)) throw new Error('APP_PORT must be an integer from 1024 to 65535');
  if (apiPort === database.port) throw new Error('APP_PORT and PGPORT must differ');
  if (!/^[a-z_][a-z0-9_]*$/.test(database.user)) throw new Error('PGUSER is invalid');
  if (!/^[a-z_][a-z0-9_]*$/.test(database.database)) throw new Error('PGDATABASE is invalid');
  if (database.password.length === 0) throw new Error('PGPASSWORD must not be empty');

  const project = realpathSync(process.cwd());
  const directory = resolve(database.directory);
  if (directory === project || !insideProject(directory, project)) {
    throw new Error('PGDATA_DIR must be a directory inside the project');
  }

  // Resolve symlinks in the directory or parent before PostgreSQL can write to them.
  const existing = lstatSync(directory, { throwIfNoEntry: false });
  const actual =
    existing === undefined ? realpathSync(dirname(directory)) : realpathSync(directory);
  if (!insideProject(actual, project)) throw new Error('PGDATA_DIR resolves outside the project');

  return { port: apiPort, host: '127.0.0.1' };
}
