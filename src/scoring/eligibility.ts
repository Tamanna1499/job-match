import type { Candidate, Job } from '../domain/types.js';
import { normaliseSkill, normaliseSkills } from './normalise.js';

/**
 * The must-have gate, applied before anything is scored.
 *
 * A job requiring a skill the candidate lacks is removed from consideration entirely — it
 * does not appear with a low score. Expressed as a penalty, a candidate strong enough on
 * location, salary and experience could out-score the shortfall and surface a job they
 * are not eligible for. A filter cannot be out-voted; a penalty can.
 */
export interface Eligibility {
  readonly eligible: boolean;
  /** Which must-have skills are missing. Empty when eligible. */
  readonly missingMustHave: readonly string[];
}

export function checkEligibility(candidate: Candidate, job: Job): Eligibility {
  const held = normaliseSkills(candidate.skills);

  const missingMustHave = job.requiredSkills
    .filter((required) => required.mustHave && !held.has(normaliseSkill(required.skill)))
    .map((required) => required.skill);

  return { eligible: missingMustHave.length === 0, missingMustHave };
}
