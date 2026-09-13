import { describe, expect, it } from 'vitest';
import { checkEligibility } from '../../src/scoring/eligibility.js';
import { aCandidate, aJob, must, nice } from './fixtures.js';

describe('the must-have gate', () => {
  it('admits a candidate holding every must-have skill', () => {
    const result = checkEligibility(aCandidate(), aJob());
    expect(result.eligible).toBe(true);
    expect(result.missingMustHave).toEqual([]);
  });

  it('excludes a candidate missing one must-have skill', () => {
    const job = aJob({ requiredSkills: [must('TypeScript'), must('Kubernetes')] });
    const result = checkEligibility(aCandidate(), job);

    expect(result.eligible).toBe(false);
    expect(result.missingMustHave).toEqual(['Kubernetes']);
  });

  it('names every missing must-have, not just the first', () => {
    const job = aJob({ requiredSkills: [must('Kubernetes'), must('Go'), must('TypeScript')] });
    expect(checkEligibility(aCandidate(), job).missingMustHave).toEqual(['Kubernetes', 'Go']);
  });

  it('never excludes on a nice-to-have, however many are missing', () => {
    const job = aJob({
      requiredSkills: [must('TypeScript'), nice('Rust'), nice('Elixir'), nice('Haskell')],
    });
    expect(checkEligibility(aCandidate(), job).eligible).toBe(true);
  });

  it('admits a job with no required skills at all', () => {
    expect(checkEligibility(aCandidate(), aJob({ requiredSkills: [] })).eligible).toBe(true);
  });

  it('matches must-have skills through normalisation', () => {
    // The candidate holds "Node.js"; the job asks for "nodejs".
    const job = aJob({ requiredSkills: [must('nodejs')] });
    expect(checkEligibility(aCandidate(), job).eligible).toBe(true);
  });

  it('ignores candidate skills the job never asked for', () => {
    const candidate = aCandidate({ skills: ['TypeScript', 'Cobol', 'Fortran'] });
    const job = aJob({ requiredSkills: [must('TypeScript')] });
    expect(checkEligibility(candidate, job).eligible).toBe(true);
  });

  it('cannot be out-scored: a perfect candidate missing one must-have is still excluded', () => {
    // Same city, salary comfortably covered, years well over the minimum — and still out.
    // This is the property that makes the gate a filter rather than a penalty.
    const perfect = aCandidate({ yearsOfExperience: 20, expectedSalaryLpa: 5 });
    const job = aJob({
      requiredSkills: [must('Kubernetes')],
      location: 'Bengaluru',
      minYearsExperience: 2,
      salaryRangeLpa: { min: 20, max: 40 },
    });

    expect(checkEligibility(perfect, job).eligible).toBe(false);
  });
});
