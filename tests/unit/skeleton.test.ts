import { describe, expect, it } from 'vitest';
import { validateRuntimeConfig } from '../../src/config/runtime.js';
import { DATABASE } from '../../src/config/database.js';

describe('startup configuration', () => {
  it('accepts the project-local database and a separate API port', () => {
    expect(validateRuntimeConfig(DATABASE, 3107)).toEqual({ port: 3107, host: '127.0.0.1' });
  });

  it('rejects an invalid or conflicting port before startup', () => {
    expect(() => validateRuntimeConfig(DATABASE, 5434)).toThrow('must differ');
    expect(() => validateRuntimeConfig({ ...DATABASE, port: Number.NaN }, 3107)).toThrow('PGPORT');
    expect(() => validateRuntimeConfig(DATABASE, 65536)).toThrow('APP_PORT');
  });

  it('rejects a database directory outside the project', () => {
    expect(() => validateRuntimeConfig({ ...DATABASE, directory: '/tmp' }, 3107)).toThrow(
      'PGDATA_DIR',
    );
  });
});
