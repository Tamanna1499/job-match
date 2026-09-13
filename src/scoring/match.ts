import type { Candidate, DimensionScore, Job, JobMatch } from '../domain/types.js';
import { checkEligibility } from './eligibility.js';
import { scoreExperience, scoreLocation, scoreSalary, scoreSkills } from './dimensions.js';

/**
 * Scores one job for one candidate, and ranks a set of them.
 *
 * The gate runs first and returns nothing at all for an ineligible job — not a low score.
 * Everything downstream only ever sees jobs the candidate could actually take.
 */

/** Ordered so the breakdown always reads the same way, and so ties break in weight order. */
const ORDER = ['skills', 'location', 'salary', 'experience'] as const;

export interface ExcludedJob {
  readonly jobId: string;
  readonly missingMustHave: readonly string[];
}

export type ScoreResult =
  | { readonly eligible: true; readonly match: JobMatch }
  | { readonly eligible: false; readonly excluded: ExcludedJob };

export function scoreJob(candidate: Candidate, job: Job): ScoreResult {
  const eligibility = checkEligibility(candidate, job);

  if (!eligibility.eligible) {
    return {
      eligible: false,
      excluded: { jobId: job.id, missingMustHave: eligibility.missingMustHave },
    };
  }

  const breakdown: DimensionScore[] = [
    scoreSkills(candidate, job),
    scoreLocation(candidate, job),
    scoreSalary(candidate, job),
    scoreExperience(candidate, job),
  ];

  const score = round(breakdown.reduce((total, entry) => total + entry.earned, 0));
  return { eligible: true, match: { jobId: job.id, score, breakdown } };
}

export interface RankOptions {
  readonly limit?: number;
}

/**
 * Ranks eligible jobs highest first.
 *
 * Ties break by dimension in weight order — skills, then location, then salary, then
 * experience — so two jobs on the same total are separated by the one that matters most.
 * Job id settles anything still tied, because a ranking that reorders between identical
 * requests is a bug that surfaces later as flakiness.
 */
export function rankJobs(
  candidate: Candidate,
  jobs: readonly Job[],
  options: RankOptions = {},
): readonly JobMatch[] {
  const matches = jobs
    .map((job) => scoreJob(candidate, job))
    .filter((result): result is Extract<ScoreResult, { eligible: true }> => result.eligible)
    .map((result) => result.match)
    .sort(compare);

  return options.limit === undefined ? matches : matches.slice(0, Math.max(0, options.limit));
}

function compare(left: JobMatch, right: JobMatch): number {
  if (left.score !== right.score) return right.score - left.score;

  for (const dimension of ORDER) {
    const difference = earned(right, dimension) - earned(left, dimension);
    if (difference !== 0) return difference;
  }
  return left.jobId.localeCompare(right.jobId);
}

function earned(match: JobMatch, dimension: (typeof ORDER)[number]): number {
  return match.breakdown.find((entry) => entry.dimension === dimension)?.earned ?? 0;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
