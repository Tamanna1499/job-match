import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:net';
import { DATABASE } from '../../src/config/database.js';
import { startServer, type RunningServer } from '../../src/server.js';
import { assertTestDatabase } from '../support/database.js';

let server: RunningServer | undefined;

beforeAll(() => assertTestDatabase(DATABASE));
afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('server lifecycle', () => {
  it('serves a health response from a migrated PostgreSQL database', async () => {
    server = await startServer();

    const response = await fetch('http://127.0.0.1:3108/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('releases the HTTP port and database cluster on shutdown, then restarts', async () => {
    server = await startServer();
    await server.close();

    await expect(fetch('http://127.0.0.1:3108/health')).rejects.toThrow();

    server = await startServer();
    const response = await fetch('http://127.0.0.1:3108/health');
    expect(response.status).toBe(200);
  });

  it('releases PostgreSQL when the HTTP port is already occupied', async () => {
    const blocker = createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(3108, '127.0.0.1', resolve);
    });

    try {
      await expect(startServer()).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve, reject) => {
        blocker.close((error) => (error === undefined ? resolve() : reject(error)));
      });
    }

    server = await startServer();
    const response = await fetch('http://127.0.0.1:3108/health');
    expect(response.status).toBe(200);
  });
});
