import { describe, expect, it } from 'vitest';
import {
  scoreExperience,
  scoreLocation,
  scoreSalary,
  scoreSkills,
} from '../../src/scoring/dimensions.js';
import { aCandidate, aJob, must, nice } from './fixtures.js';

describe('skills — 50 points', () => {
  it('awards the full 50 when the job lists no nice-to-have skills', () => {
    const job = aJob({ requiredSkills: [must('TypeScript')] });
    expect(scoreSkills(aCandidate(), job).earned).toBe(50);
  });

  it('awards 40 for clearing the bar with none of the nice-to-haves matched', () => {
    const job = aJob({ requiredSkills: [must('TypeScript'), nice('Rust'), nice('Go')] });
    expect(scoreSkills(aCandidate(), job).earned).toBe(40);
  });

  it('awards the full 50 when every nice-to-have is matched too', () => {
    const job = aJob({ requiredSkills: [must('TypeScript'), nice('React'), nice('Node.js')] });
    expect(scoreSkills(aCandidate(), job).earned).toBe(50);
  });

  it('scales the nice-to-have share by coverage', () => {
    // Two of four matched → 40 + 10 × 0.5
    const job = aJob({
      requiredSkills: [
        must('TypeScript'),
        nice('React'),
        nice('Node.js'),
        nice('Go'),
        nice('Rust'),
      ],
    });
    expect(scoreSkills(aCandidate(), job).earned).toBe(45);
  });

  it('applies no penalty for unmatched nice-to-haves beyond the missed share', () => {
    const one = aJob({ requiredSkills: [must('TypeScript'), nice('Rust')] });
    const many = aJob({
      requiredSkills: [must('TypeScript'), nice('Rust'), nice('Go'), nice('Elixir')],
    });
    // Zero coverage either way — the floor is the same 40, not deeper with more misses.
    expect(scoreSkills(aCandidate(), one).earned).toBe(40);
    expect(scoreSkills(aCandidate(), many).earned).toBe(40);
  });

  it('explains the count it scored from', () => {
    const job = aJob({ requiredSkills: [must('TypeScript'), nice('React'), nice('Go')] });
    expect(scoreSkills(aCandidate(), job).reason).toContain('1 of 2 nice-to-have');
  });
});

describe('location — 25 points', () => {
  it('awards 25 for the same location', () => {
    expect(scoreLocation(aCandidate(), aJob({ location: 'Bengaluru' })).earned).toBe(25);
  });

  it('awards 25 regardless of spelling or case', () => {
    const candidate = aCandidate({ location: 'bengaluru ' });
    expect(scoreLocation(candidate, aJob({ location: 'Bengaluru' })).earned).toBe(25);
  });

  it('awards 20 for a different location when the role is remote-friendly', () => {
    const job = aJob({ location: 'Pune', remoteAllowed: true });
    expect(scoreLocation(aCandidate(), job).earned).toBe(20);
  });

  it('awards 8 — never 0 — for an on-site role elsewhere', () => {
    const job = aJob({ location: 'Pune', remoteAllowed: false });
    expect(scoreLocation(aCandidate(), job).earned).toBe(8);
  });

  it('ranks exact above remote above mismatch', () => {
    const here = scoreLocation(aCandidate(), aJob({ location: 'Bengaluru' })).earned;
    const remote = scoreLocation(
      aCandidate(),
      aJob({ location: 'Pune', remoteAllowed: true }),
    ).earned;
    const away = scoreLocation(aCandidate(), aJob({ location: 'Pune' })).earned;
    expect(here).toBeGreaterThan(remote);
    expect(remote).toBeGreaterThan(away);
  });

  it('prefers an exact match even when the role also allows remote', () => {
    const job = aJob({ location: 'Bengaluru', remoteAllowed: true });
    expect(scoreLocation(aCandidate(), job).earned).toBe(25);
  });
});

describe('salary — 15 points', () => {
  /** The ten worked examples from Scoring-logic.md, at an expectation of ₹12 LPA. */
  const vectors: readonly [number, number, number][] = [
    [5, 8, 3],
    [8, 10, 3],
    [5, 12, 8],
    [8, 12, 10],
    [9, 14, 12],
    [10, 12, 15],
    [10, 15, 15],
    [12, 20, 15],
    [15, 25, 15],
    [5, 20, 8],
  ];

  for (const [min, max, expected] of vectors) {
    it(`scores ₹${min}–${max} as ${expected} for a ₹12 LPA expectation`, () => {
      const job = aJob({ salaryRangeLpa: { min, max } });
      expect(scoreSalary(aCandidate(), job).earned).toBe(expected);
    });
  }

  it('scores each band boundary exactly', () => {
    const at = (min: number) =>
      scoreSalary(aCandidate(), aJob({ salaryRangeLpa: { min, max: 30 } })).earned;
    expect(at(10)).toBe(15); // gap 2
    expect(at(9)).toBe(12); // gap 3
    expect(at(8)).toBe(10); // gap 4
    expect(at(7)).toBe(8); // gap 5, beyond the bands
  });

  it('treats a maximum exactly equal to the expectation as reachable', () => {
    const job = aJob({ salaryRangeLpa: { min: 11, max: 12 } });
    expect(scoreSalary(aCandidate(), job).earned).toBe(15);
  });

  it('scores a range entirely above the expectation at full marks', () => {
    const job = aJob({ salaryRangeLpa: { min: 20, max: 30 } });
    // Being offered more than asked for is the best outcome, not a mismatch.
    expect(scoreSalary(aCandidate(), job).earned).toBe(15);
  });

  it('scores every unreachable range the same, however far below', () => {
    const near = scoreSalary(aCandidate(), aJob({ salaryRangeLpa: { min: 9, max: 11 } })).earned;
    const far = scoreSalary(aCandidate(), aJob({ salaryRangeLpa: { min: 2, max: 4 } })).earned;
    expect(near).toBe(3);
    expect(far).toBe(3);
  });
});

describe('experience — 10 points', () => {
  it('awards 10 when the minimum is met exactly', () => {
    const candidate = aCandidate({ yearsOfExperience: 3 });
    expect(scoreExperience(candidate, aJob({ minYearsExperience: 3 })).earned).toBe(10);
  });

  it('awards 10 when the job requires none', () => {
    const candidate = aCandidate({ yearsOfExperience: 0 });
    expect(scoreExperience(candidate, aJob({ minYearsExperience: 0 })).earned).toBe(10);
  });

  it('awards no more for being far over the minimum', () => {
    const candidate = aCandidate({ yearsOfExperience: 25 });
    expect(scoreExperience(candidate, aJob({ minYearsExperience: 3 })).earned).toBe(10);
  });

  it('awards 8 for exactly one year short', () => {
    const candidate = aCandidate({ yearsOfExperience: 4 });
    expect(scoreExperience(candidate, aJob({ minYearsExperience: 5 })).earned).toBe(8);
  });

  it('awards 8 for half a year short — the band is inclusive', () => {
    const candidate = aCandidate({ yearsOfExperience: 4.5 });
    expect(scoreExperience(candidate, aJob({ minYearsExperience: 5 })).earned).toBe(8);
  });

  it('awards 5 once more than a year short', () => {
    const candidate = aCandidate({ yearsOfExperience: 3.5 });
    expect(scoreExperience(candidate, aJob({ minYearsExperience: 5 })).earned).toBe(5);
  });

  it('awards 5, never less, for a complete beginner', () => {
    const candidate = aCandidate({ yearsOfExperience: 0 });
    const score = scoreExperience(candidate, aJob({ minYearsExperience: 10 }));
    expect(score.earned).toBe(5);
    expect(score.earned).toBeGreaterThan(0);
  });
});
