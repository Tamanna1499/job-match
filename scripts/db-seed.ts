/**
 * Seeds a small local dataset and prints recommendations: `npm run db:seed`.
 *
 * The examples intentionally cover the cases that are easiest to miss in a manual demo:
 * a strong match, a missing must-have, a short experience history, and a low salary cap.
 * This is development data, so each run creates a fresh set of records.
 */
import { connect, disconnect } from '../src/db/client.js';
import { startCluster, stopCluster } from '../src/db/cluster.js';
import type { Candidate, Job, NewCandidate, NewJob } from '../src/domain/types.js';
import { createRepositories } from '../src/repository/postgres.js';
import { rankJobs } from '../src/scoring/match.js';

const logger = {
  error: (message: string): void => {
    process.stderr.write(`[db] ${message}\n`);
  },
};

const candidates: readonly NewCandidate[] = [
  {
    name: 'Asha Sharma',
    skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
    yearsOfExperience: 5,
    location: 'Pune',
    expectedSalaryLpa: 12,
  },
  {
    name: 'Ravi Kumar',
    skills: ['Python', 'Django'],
    yearsOfExperience: 2,
    location: 'Mumbai',
    expectedSalaryLpa: 10,
  },
];

const jobs: readonly NewJob[] = [
  {
    title: 'Senior Backend Engineer',
    requiredSkills: [
      { skill: 'TypeScript', mustHave: true },
      { skill: 'Node.js', mustHave: true },
      { skill: 'PostgreSQL', mustHave: false },
    ],
    minYearsExperience: 4,
    location: 'Pune',
    salaryRangeLpa: { min: 10, max: 16 },
    remoteAllowed: false,
  },
  {
    title: 'Kubernetes Platform Engineer',
    requiredSkills: [{ skill: 'Kubernetes', mustHave: true }],
    minYearsExperience: 3,
    location: 'Pune',
    salaryRangeLpa: { min: 12, max: 18 },
    remoteAllowed: true,
  },
  {
    title: 'Backend Engineer',
    requiredSkills: [{ skill: 'Python', mustHave: false }],
    minYearsExperience: 4,
    location: 'Bengaluru',
    salaryRangeLpa: { min: 5, max: 8 },
    remoteAllowed: false,
  },
];

async function main(): Promise<void> {
  await startCluster();
  try {
    const database = await connect(logger);
    const repositories = createRepositories(database);
    const createdCandidates: Candidate[] = [];
    for (const candidate of candidates) {
      createdCandidates.push(await repositories.candidates.create(candidate));
    }

    const createdJobs: Job[] = [];
    for (const job of jobs) createdJobs.push(await repositories.jobs.create(job));

    process.stdout.write(
      `Seeded ${String(createdCandidates.length)} candidates and ${String(createdJobs.length)} jobs.\n`,
    );
    for (const candidate of createdCandidates) {
      const matches = rankJobs(candidate, createdJobs, { limit: 10 });
      process.stdout.write(`\n${candidate.name} (${candidate.id})\n`);
      process.stdout.write(`${JSON.stringify(matches, null, 2)}\n`);
    }
  } finally {
    await disconnect();
    await stopCluster();
  }
}

await main();
