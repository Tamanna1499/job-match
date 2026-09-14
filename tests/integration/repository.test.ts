import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { connect, disconnect } from '../../src/db/client.js';
import { startCluster, stopCluster } from '../../src/db/cluster.js';
import { candidates, jobRequiredSkills, jobs } from '../../src/db/schema.js';
import type { Repositories } from '../../src/repository/types.js';
import { createRepositories } from '../../src/repository/postgres.js';
import type { Database } from '../../src/db/client.js';
import { DATABASE } from '../../src/config/database.js';
import { assertTestDatabase, TEST_DATABASE_ENV } from '../support/database.js';

/**
 * These run against real PostgreSQL, not a stub.
 *
 * A fake repository would prove the code compiles against its own assumptions. The things
 * that actually break in storage — a transaction that does not roll back, an array column
 * that comes back in the wrong shape, a constraint that was never applied — only show up
 * against the real thing.
 */

let database: Database;
let repositories: Repositories;

const silent = { error: (): void => undefined };

beforeAll(async () => {
  assertTestDatabase(DATABASE);
  await startCluster();
  database = await connect(silent);
  repositories = createRepositories(database);
});

afterEach(async () => {
  // A refused target or failed startup must never reach destructive cleanup.
  if (database === undefined) return;
  await database.delete(jobRequiredSkills);
  await database.delete(jobs);
  await database.delete(candidates);
});

afterAll(async () => {
  await disconnect();
  await stopCluster();
});

const aCandidate = {
  name: 'Asha',
  skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
  yearsOfExperience: 4,
  location: 'Pune',
  expectedSalaryLpa: 12,
};

const aJob = {
  title: 'Backend Engineer',
  requiredSkills: [
    { skill: 'TypeScript', mustHave: true },
    { skill: 'Kubernetes', mustHave: false },
  ],
  minYearsExperience: 3,
  location: 'Pune',
  salaryRangeLpa: { min: 10, max: 18 },
  remoteAllowed: false,
};

it('connects to the reserved test database and cluster', async () => {
  const result = await database.execute(`select current_database() as name,
    current_setting('port') as port, current_setting('data_directory') as directory`);

  expect(result.rows).toEqual([
    {
      name: TEST_DATABASE_ENV.PGDATABASE,
      port: TEST_DATABASE_ENV.PGPORT,
      directory: TEST_DATABASE_ENV.PGDATA_DIR,
    },
  ]);
});

describe('candidate repository', () => {
  it('returns the stored candidate with a server-minted id', async () => {
    const created = await repositories.candidates.create(aCandidate);

    expect(created.id).not.toBe('');
    expect(created).toMatchObject(aCandidate);
  });

  it('reads back exactly what was written, array column included', async () => {
    const created = await repositories.candidates.create(aCandidate);
    const found = await repositories.candidates.findById(created.id);

    expect(found).toEqual(created);
    expect(found?.skills).toEqual(['TypeScript', 'Node.js', 'PostgreSQL']);
  });

  it('gives every candidate a distinct id', async () => {
    const first = await repositories.candidates.create(aCandidate);
    const second = await repositories.candidates.create(aCandidate);

    expect(first.id).not.toBe(second.id);
  });

  it('returns undefined for an unknown id rather than throwing', async () => {
    await expect(repositories.candidates.findById('does-not-exist')).resolves.toBeUndefined();
  });

  it('preserves a fractional year, because eighteen months is a real answer', async () => {
    const created = await repositories.candidates.create({ ...aCandidate, yearsOfExperience: 1.5 });
    const found = await repositories.candidates.findById(created.id);

    expect(found?.yearsOfExperience).toBe(1.5);
  });
});

describe('job repository', () => {
  it('round-trips a job with its required skills and must-have flags', async () => {
    const created = await repositories.jobs.create(aJob);
    const [found] = await repositories.jobs.findAll();

    expect(found).toEqual(created);
    expect(found?.requiredSkills).toEqual(
      expect.arrayContaining([
        { skill: 'TypeScript', mustHave: true },
        { skill: 'Kubernetes', mustHave: false },
      ]),
    );
  });

  it('stores a job that requires no skills at all', async () => {
    const created = await repositories.jobs.create({ ...aJob, requiredSkills: [] });
    const [found] = await repositories.jobs.findAll();

    expect(found).toEqual(created);
    expect(found?.requiredSkills).toEqual([]);
  });

  it('returns an empty list when nothing is stored', async () => {
    await expect(repositories.jobs.findAll()).resolves.toEqual([]);
  });

  it('keeps each job with its own skills when several are stored', async () => {
    const backend = await repositories.jobs.create(aJob);
    const frontend = await repositories.jobs.create({
      ...aJob,
      title: 'Frontend Engineer',
      requiredSkills: [{ skill: 'React', mustHave: true }],
    });

    const all = await repositories.jobs.findAll();
    const byId = new Map(all.map((job) => [job.id, job]));

    expect(byId.get(backend.id)?.requiredSkills).toHaveLength(2);
    expect(byId.get(frontend.id)?.requiredSkills).toEqual([{ skill: 'React', mustHave: true }]);
  });

  it('returns jobs in a stable order across identical reads', async () => {
    await repositories.jobs.create(aJob);
    await repositories.jobs.create({ ...aJob, title: 'Second' });
    await repositories.jobs.create({ ...aJob, title: 'Third' });

    const first = (await repositories.jobs.findAll()).map((job) => job.id);
    const second = (await repositories.jobs.findAll()).map((job) => job.id);

    expect(first).toEqual(second);
  });

  it('rolls the job back when its skills cannot be written', async () => {
    /**
     * The same skill twice violates the primary key on (job_id, skill). If the insert
     * were not transactional, the job would survive with no must-have rows — a job every
     * candidate is eligible for, created by a failed request.
     */
    await expect(
      repositories.jobs.create({
        ...aJob,
        requiredSkills: [
          { skill: 'TypeScript', mustHave: true },
          { skill: 'TypeScript', mustHave: false },
        ],
      }),
    ).rejects.toThrow();

    await expect(repositories.jobs.findAll()).resolves.toEqual([]);
  });

  it('refuses a job whose salary range is inverted', async () => {
    await expect(
      repositories.jobs.create({ ...aJob, salaryRangeLpa: { min: 20, max: 10 } }),
    ).rejects.toThrow();
  });
});
