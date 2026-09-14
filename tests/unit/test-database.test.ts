import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import { assertTestDatabase, TEST_DATABASE_ENV } from '../support/database.js';

vi.mock('node:fs', () => ({ lstatSync: vi.fn() }));

const testDatabase = {
  directory: TEST_DATABASE_ENV.PGDATA_DIR,
  port: Number(TEST_DATABASE_ENV.PGPORT),
  database: TEST_DATABASE_ENV.PGDATABASE,
};

beforeEach(() => vi.resetAllMocks());

describe('integration database guard', () => {
  it('allows the reserved test target before its first startup', () => {
    expect(() => assertTestDatabase(testDatabase)).not.toThrow();
  });

  it('allows an existing test directory on subsequent runs', () => {
    vi.mocked(fs.lstatSync).mockReturnValue({ isSymbolicLink: () => false } as fs.Stats);
    expect(() => assertTestDatabase(testDatabase)).not.toThrow();
  });

  it.each([
    { directory: '.pgdata' },
    { directory: `${TEST_DATABASE_ENV.PGDATA_DIR}/../.pgdata` },
    { port: 5434 },
    { database: 'jobmatch' },
  ])('refuses a development target before accessing its directory: %j', (override) => {
    expect(() => assertTestDatabase({ ...testDatabase, ...override })).toThrow(
      'Refusing integration tests',
    );
    expect(fs.lstatSync).not.toHaveBeenCalled();
  });

  it('refuses a test directory that redirects to another cluster', () => {
    const symlink = { isSymbolicLink: () => true } as fs.Stats;
    vi.mocked(fs.lstatSync).mockReturnValue(symlink);
    expect(() => assertTestDatabase(testDatabase)).toThrow('Refusing a symlink');
  });
});
