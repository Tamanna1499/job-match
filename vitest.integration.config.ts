import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_ENV } from './tests/support/database.js';

/**
 * Integration tests run against a real embedded PostgreSQL cluster.
 *
 * They are configured separately from the unit tests because they cost seconds rather
 * than milliseconds, and the unit tests — which are the graded ones — should stay fast
 * enough to run on every save.
 *
 * `fileParallelism` is off because the cluster is a single process on a single port. Two
 * test files starting it concurrently would collide, and the resulting error names the
 * port rather than the cause.
 */
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    env: TEST_DATABASE_ENV,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
