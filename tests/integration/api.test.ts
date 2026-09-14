import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/api/app.js';
import { DATABASE } from '../../src/config/database.js';
import { connect, disconnect, type Database } from '../../src/db/client.js';
import { startCluster, stopCluster } from '../../src/db/cluster.js';
import type { Candidate, Job, NewCandidate, NewJob } from '../../src/domain/types.js';
import { createRepositories } from '../../src/repository/postgres.js';
import type { Repositories } from '../../src/repository/types.js';
import { assertTestDatabase } from '../support/database.js';
import { clearTestTables } from '../support/clear-database.js';

let database: Database;
let repositories: Repositories;
let app: FastifyInstance;

beforeAll(async () => {
  assertTestDatabase(DATABASE);
  await startCluster();
  database = await connect({ error: () => undefined });
  repositories = createRepositories(database);
  app = createApp(repositories);
  await app.ready();
});

afterEach(async () => {
  if (database !== undefined) await clearTestTables(database);
});

afterAll(async () => {
  await app?.close();
  await disconnect();
  await stopCluster();
});

const candidateBody: NewCandidate = {
  name: 'Asha',
  skills: ['TypeScript', 'Node.js'],
  yearsOfExperience: 4,
  location: 'Pune',
  expectedSalaryLpa: 12,
};

const jobBody: NewJob = {
  title: 'Backend Engineer',
  requiredSkills: [{ skill: 'TypeScript', mustHave: true }],
  minYearsExperience: 3,
  location: 'Pune',
  salaryRangeLpa: { min: 10, max: 15 },
  remoteAllowed: false,
};

async function createCandidate(overrides: Partial<NewCandidate> = {}): Promise<Candidate> {
  const response = await app.inject({
    method: 'POST',
    url: '/candidates',
    payload: { ...candidateBody, ...overrides },
  });
  expect(response.statusCode).toBe(201);
  return response.json() as Candidate;
}

async function createJob(overrides: Partial<NewJob> = {}): Promise<Job> {
  const response = await app.inject({
    method: 'POST',
    url: '/jobs',
    payload: { ...jobBody, ...overrides },
  });
  expect(response.statusCode).toBe(201);
  return response.json() as Job;
}

describe('POST /candidates', () => {
  it('creates and persists a candidate with a server-generated id', async () => {
    const created = await createCandidate();
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await repositories.candidates.findById(created.id)).toEqual(created);
  });

  it('rejects unknown fields and invalid values with the same 400 shape', async () => {
    for (const payload of [
      { ...candidateBody, expectedSaleryLpa: 12 },
      { ...candidateBody, yearsOfExperience: -1 },
      { ...candidateBody, skills: ['!!!'] },
    ]) {
      const response = await app.inject({ method: 'POST', url: '/candidates', payload });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: { code: 'INVALID_REQUEST', message: 'Invalid request' },
      });
    }
  });
});

describe('POST /jobs', () => {
  it('creates a job with its required skills and salary range', async () => {
    const created = await createJob({
      requiredSkills: [
        { skill: 'TypeScript', mustHave: true },
        { skill: 'Node.js', mustHave: false },
      ],
    });
    expect((await repositories.jobs.findAll())[0]).toEqual(created);
  });

  it('rejects invalid ranges, repeated skills, and unknown nested fields before storage', async () => {
    for (const payload of [
      { ...jobBody, salaryRangeLpa: { min: 20, max: 10 } },
      {
        ...jobBody,
        requiredSkills: [
          { skill: 'Node.js', mustHave: true },
          { skill: 'node js', mustHave: false },
        ],
      },
      { ...jobBody, salaryRangeLpa: { min: 10, max: 15, currency: 'INR' } },
    ]) {
      const response = await app.inject({ method: 'POST', url: '/jobs', payload });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: { code: 'INVALID_REQUEST', message: 'Invalid request' },
      });
    }
    expect(await repositories.jobs.findAll()).toEqual([]);
  });
});

describe('GET /candidates/:id/recommendations', () => {
  it('ranks eligible jobs, explains the score, filters must-have misses, and honors limit', async () => {
    const candidate = await createCandidate();
    const ideal = await createJob({
      title: 'Ideal',
      requiredSkills: [
        { skill: 'TypeScript', mustHave: true },
        { skill: 'Node.js', mustHave: false },
      ],
    });
    const weaker = await createJob({
      title: 'Weaker',
      location: 'Mumbai',
      salaryRangeLpa: { min: 5, max: 8 },
    });
    await createJob({
      title: 'Blocked',
      requiredSkills: [{ skill: 'Kubernetes', mustHave: true }],
    });

    const full = await app.inject({
      method: 'GET',
      url: `/candidates/${candidate.id}/recommendations`,
    });
    expect(full.statusCode).toBe(200);
    expect(full.json().map((match: { jobId: string }) => match.jobId)).toEqual([
      ideal.id,
      weaker.id,
    ]);
    expect(full.json()[0].score).toBe(100);
    expect(full.json()[0].breakdown).toHaveLength(4);

    const limited = await app.inject({
      method: 'GET',
      url: `/candidates/${candidate.id}/recommendations?limit=1`,
    });
    expect(limited.json().map((match: { jobId: string }) => match.jobId)).toEqual([ideal.id]);
  });

  it('returns 200 with an empty list when no job clears the must-have gate', async () => {
    const candidate = await createCandidate({ skills: [] });
    await createJob();
    const response = await app.inject({
      method: 'GET',
      url: `/candidates/${candidate.id}/recommendations`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('returns 404 for an unknown candidate', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/candidates/does-not-exist/recommendations',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Candidate not found' },
    });
  });

  it('rejects invalid limits and unknown query fields', async () => {
    const candidate = await createCandidate();
    for (const suffix of ['limit=0', 'limit=101', 'limit=abc', 'unexpected=1']) {
      const response = await app.inject({
        method: 'GET',
        url: `/candidates/${candidate.id}/recommendations?${suffix}`,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: { code: 'INVALID_REQUEST', message: 'Invalid request' },
      });
    }
  });
});
