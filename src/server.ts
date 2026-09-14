import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import exitHook from 'async-exit-hook';
import { createApp } from './api/app.js';
import { DATABASE } from './config/database.js';
import { validateRuntimeConfig } from './config/runtime.js';
import { connect, disconnect } from './db/client.js';
import { startCluster, stopCluster } from './db/cluster.js';
import { createRepositories } from './repository/postgres.js';

export interface RunningServer {
  readonly app: FastifyInstance;
  close(): Promise<void>;
}

/** Migrations finish before the HTTP socket is opened. */
export async function startServer(): Promise<RunningServer> {
  const config = validateRuntimeConfig();
  let app: FastifyInstance | undefined;

  try {
    await startCluster();
    const database = await connect({
      error: (message) => app?.log.error(message),
    });
    const runningApp = createApp(createRepositories(database).health);
    app = runningApp;
    await runningApp.listen({ port: config.port, host: config.host });

    let closing: Promise<void> | undefined;
    return {
      app: runningApp,
      close: () => {
        closing ??= (async () => {
          try {
            await runningApp.close();
          } finally {
            try {
              await disconnect();
            } finally {
              await stopCluster();
            }
          }
        })();
        return closing;
      },
    };
  } catch (error: unknown) {
    try {
      await app?.close();
    } finally {
      try {
        await disconnect();
      } finally {
        await stopCluster();
      }
    }
    throw error;
  }
}

export async function main(): Promise<void> {
  // embedded-postgres registers a process.exit(143) handler for SIGTERM. Its exit races
  // Fastify's request drain, so the application owns these two signals instead.
  exitHook.unhookEvent('SIGINT');
  exitHook.unhookEvent('SIGTERM');
  const starting = startServer();
  let stopping = false;
  const stop = (): void => {
    if (stopping) return;
    stopping = true;
    void starting
      .then((server) => server.close())
      .catch((error: unknown) => {
        logFailure('shutdown', error);
      });
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await starting;
  } catch (error: unknown) {
    logFailure('startup', error);
  }
}

function logFailure(stage: 'startup' | 'shutdown', error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const redacted =
    DATABASE.password.length > 0 ? message.replaceAll(DATABASE.password, '[redacted]') : message;
  process.stderr.write(`${JSON.stringify({ level: 'error', stage, message: redacted })}\n`);
  process.exitCode = 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
