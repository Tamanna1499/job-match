import type { Config } from 'drizzle-kit';

/**
 * Used by `npm run db:generate` to turn the schema into SQL. Generation is offline — it
 * reads the schema file only — so no connection details belong here.
 */
export default {
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
} satisfies Config;
