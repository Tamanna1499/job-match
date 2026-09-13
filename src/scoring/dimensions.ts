import { EXPERIENCE, DIMENSION_MAX, LOCATION, SALARY, SKILLS } from '../config/weights.js';
import type { Candidate, DimensionScore, Job } from '../domain/types.js';
import { normaliseLocation, normaliseSkill, normaliseSkills } from './normalise.js';

/**
 * The four scoring dimensions, one pure function each.
 *
 * Every function returns the points earned, the maximum available, and a reason built
 * from the same values that produced the points — so an explanation cannot describe a
 * score it did not come from.
 *
 * Only skills can disqualify, and that happens in the gate before any of this runs.
 * Location, salary and experience never exclude a job; they only move it down the list.
 */

/**
 * Skills — 40 for clearing the must-have bar, 10 for nice-to-have coverage.
 *
 * The 40 is constant across every job a candidate is eligible for, so it does not affect
 * ordering. It keeps the absolute score honest: a job you are fully qualified for should
 * not read as a poor match. Nice-to-have coverage is what actually differentiates.
 */
export function scoreSkills(candidate: Candidate, job: Job): DimensionScore {
  const held = normaliseSkills(candidate.skills);
  const niceToHave = job.requiredSkills.filter((required) => !required.mustHave);
  const matched = niceToHave.filter((required) => held.has(normaliseSkill(required.skill)));

  if (niceToHave.length === 0) {
    return {
      dimension: 'skills',
      earned: DIMENSION_MAX.skills,
      max: DIMENSION_MAX.skills,
      reason: 'all must-have skills matched; none listed as nice-to-have',
    };
  }

  const coverage = matched.length / niceToHave.length;
  const earned = SKILLS.mustHaveShare + SKILLS.niceToHaveShare * coverage;

  return {
    dimension: 'skills',
    earned: round(earned),
    max: DIMENSION_MAX.skills,
    reason: `all must-have skills matched; ${matched.length} of ${niceToHave.length} nice-to-have`,
  };
}

/**
 * Location — exact beats remote beats mismatch, and the gaps are the judgement.
 *
 * Exact to remote is only 5, because a remote-friendly role is workable as advertised.
 * Remote to mismatch is 12, because that one requires relocation. The floor is 8 rather
 * than 0 so the job stays visible: whether to move is the candidate's decision.
 */
export function scoreLocation(candidate: Candidate, job: Job): DimensionScore {
  const sameplace = normaliseLocation(candidate.location) === normaliseLocation(job.location);

  if (sameplace) {
    return dimension('location', LOCATION.exactMatch, `based in ${job.location}, same as the role`);
  }
  if (job.remoteAllowed) {
    return dimension(
      'location',
      LOCATION.remoteAllowed,
      'different location, but the role is remote-friendly',
    );
  }
  return dimension(
    'location',
    LOCATION.mismatch,
    `role is on-site in ${job.location}; would require relocating`,
  );
}

/**
 * Salary — how far above the range's floor the expectation sits.
 *
 * Deliberately not "position within the range". A posting of 5–20 against an expectation
 * of 12 is vague: the floor suggests they may be targeting far lower. A tight 8–12 band
 * that actually reaches the expectation is the better match, and measuring from the floor
 * ranks it higher where position-in-range would rank it lower.
 */
export function scoreSalary(candidate: Candidate, job: Job): DimensionScore {
  const expected = candidate.expectedSalaryLpa;
  const { min, max } = job.salaryRangeLpa;

  if (max < expected) {
    return dimension(
      'salary',
      SALARY.cannotMeetExpectation,
      `range tops out at ${max} LPA, below the expected ${expected} LPA`,
    );
  }

  const gap = expected - min;
  const band = SALARY.bands.find((candidateBand) => gap <= candidateBand.maxGapLpa);

  if (!band) {
    return dimension(
      'salary',
      SALARY.beyondBands,
      `expectation sits ${round(gap)} LPA above the range floor of ${min}`,
    );
  }
  return dimension(
    'salary',
    band.points,
    gap <= 0
      ? `whole range is at or above the expected ${expected} LPA`
      : `expectation sits ${round(gap)} LPA above the range floor of ${min}`,
  );
}

/**
 * Experience — a shortfall costs the ranking, never the opportunity.
 *
 * Years of experience is a proxy, and a coarse one: it measures time elapsed, not
 * capability acquired. A candidate a year short may well be stronger than one a year
 * over, and nothing in the data would let the system tell. A missing must-have skill is
 * different in kind — a statement about capability rather than a stand-in for one — which
 * is why that one excludes and this one does not.
 */
export function scoreExperience(candidate: Candidate, job: Job): DimensionScore {
  const shortfall = job.minYearsExperience - candidate.yearsOfExperience;

  if (shortfall <= 0) {
    return dimension(
      'experience',
      EXPERIENCE.meetsMinimum,
      job.minYearsExperience === 0
        ? 'no minimum experience required'
        : `${candidate.yearsOfExperience} years meets the ${job.minYearsExperience}-year minimum`,
    );
  }
  if (shortfall <= 1) {
    return dimension(
      'experience',
      EXPERIENCE.withinOneYearBelow,
      `${candidate.yearsOfExperience} years, just under the ${job.minYearsExperience}-year minimum`,
    );
  }
  return dimension(
    'experience',
    EXPERIENCE.furtherBelow,
    `${candidate.yearsOfExperience} years against a ${job.minYearsExperience}-year minimum`,
  );
}

function dimension(
  name: DimensionScore['dimension'],
  earned: number,
  reason: string,
): DimensionScore {
  return { dimension: name, earned, max: DIMENSION_MAX[name], reason };
}

/** Scores are reported to one decimal; nice-to-have coverage rarely divides evenly. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}
