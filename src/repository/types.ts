import type { Candidate, Job, NewCandidate, NewJob } from '../domain/types.js';

/**
 * Storage, stated as an interface the rest of the application can depend on.
 *
 * The routes are written against these contracts and never against Drizzle, so swapping
 * the implementation — for an in-memory one, or a different database — touches this
 * directory and nowhere else. `scoring/` depends on neither: it is handed a candidate and
 * a list of jobs and has no idea where they came from.
 */

export interface CandidateRepository {
  /** Mints an id, stores the candidate, and returns the stored record. */
  create(candidate: NewCandidate): Promise<Candidate>;
  /** `undefined` rather than a throw: an absent candidate is an expected answer here. */
  findById(id: string): Promise<Candidate | undefined>;
}

export interface JobRepository {
  create(job: NewJob): Promise<Job>;
  /**
   * Every job, in a stable order.
   *
   * Ranking is a total order over all jobs, so there is no query that narrows the set
   * first — the must-have filter is a property of the candidate, not of a single job.
   * Loading them all is right at this scale and would need a rethink at a large one;
   * that limit is recorded in the README rather than hidden here.
   */
  findAll(): Promise<readonly Job[]>;
}

export interface Repositories {
  readonly candidates: CandidateRepository;
  readonly jobs: JobRepository;
  readonly health: HealthRepository;
}

export interface HealthRepository {
  check(): Promise<boolean>;
}
