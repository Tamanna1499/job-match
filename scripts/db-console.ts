/**
 * A small SQL console for the embedded cluster: `npm run db:console`.
 *
 * `embedded-postgres` ships `initdb`, `pg_ctl` and `postgres` but no `psql`, and the
 * containment rule rules out installing one on the host. This fills that gap — it starts
 * the cluster, applies migrations, runs whatever SQL you type, and shuts the cluster down
 * again on the way out.
 *
 * Shutting down properly is the point of the signal handling below. A cluster left running
 * after Ctrl-C holds port 5434 and its lock files, so the next start fails for a reason
 * that looks nothing like the cause.
 */
import { createInterface } from 'node:readline';
import { connect, disconnect } from '../src/db/client.js';
import { startCluster, stopCluster } from '../src/db/cluster.js';

const LIST_TABLES = `select table_name as name
  from information_schema.tables
  where table_schema = 'public'
  order by 1`;

const LIST_CONSTRAINTS = `select conrelid::regclass::text as "table",
    conname as constraint_name,
    case contype
      when 'c' then 'check'
      when 'f' then 'foreign key'
      when 'p' then 'primary key'
      when 'u' then 'unique'
      else contype::text
    end as kind
  from pg_constraint
  where connamespace = 'public'::regnamespace
  order by 1, 3, 2`;

const HELP = `  \\d    list tables
  \\c    list constraints
  \\?    this help
  \\q    quit`;

const logger = {
  error: (message: string): void => {
    process.stderr.write(`[db] ${message}\n`);
  },
};

/** Postgres reports the useful part — the code and the constraint — on the chained cause. */
interface PostgresError {
  code?: string;
  constraint?: string;
  detail?: string;
  message?: string;
}

function describe(error: unknown): string {
  const cause = (error as { cause?: PostgresError }).cause;
  if (cause?.message === undefined) {
    return error instanceof Error ? error.message : String(error);
  }
  const label = [cause.code, cause.constraint].filter(Boolean).join(' ');
  return [label === '' ? 'ERROR' : `ERROR ${label}`, `      ${cause.message}`]
    .concat(cause.detail === undefined ? [] : [`      ${cause.detail}`])
    .join('\n');
}

async function main(): Promise<void> {
  process.stdout.write(`starting embedded postgres on port ${String(process.env.PGPORT ?? 5434)} ...\n`);
  await startCluster();
  const database = await connect(logger);

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await disconnect();
    await stopCluster();
    process.stdout.write('cluster stopped.\n');
  };

  /** Ctrl-C must still stop the cluster, or it outlives the process holding the port. */
  process.once('SIGINT', () => {
    process.stdout.write('\n');
    void shutdown().then(() => process.exit(0));
  });

  process.stdout.write(`ready.\n${HELP}\n\n`);

  const interactive = process.stdin.isTTY === true;
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'sql> ',
  });
  /** Piped input closes the interface as soon as it drains, so prompting is TTY-only. */
  const prompt = (): void => {
    if (interactive) readline.prompt();
  };

  prompt();

  for await (const line of readline) {
    const input = line.trim();
    if (input === '') {
      prompt();
      continue;
    }
    if (input === '\\q' || input === 'exit') break;
    if (input === '\\?') {
      process.stdout.write(`${HELP}\n`);
      prompt();
      continue;
    }

    const sql = input === '\\d' ? LIST_TABLES : input === '\\c' ? LIST_CONSTRAINTS : input;
    try {
      const result = await database.execute(sql);
      if (result.rows.length > 0) console.table(result.rows);
      else process.stdout.write(`ok (${String(result.rowCount ?? 0)} rows affected)\n`);
    } catch (error) {
      process.stdout.write(`${describe(error)}\n`);
    }
    prompt();
  }

  readline.close();
  await shutdown();
}

await main();
