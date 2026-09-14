import type { JobMatch } from '../domain/types.js';
import { NotFoundError } from '../domain/errors.js';
import type { CandidateRepository, JobRepository } from '../repository/types.js';
import { rankJobs } from '../scoring/match.js';

export async function recommendJobs(
  candidateId: string,
  limit: number,
  candidates: CandidateRepository,
  jobs: JobRepository,
): Promise<readonly JobMatch[]> {
  const candidate = await candidates.findById(candidateId);
  if (candidate === undefined) throw new NotFoundError('Candidate not found');
  return rankJobs(candidate, await jobs.findAll(), { limit });
}
