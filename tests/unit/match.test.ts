import { describe, expect, it } from 'vitest';
import { TOTAL_MAX } from '../../src/config/weights.js';
import { rankJobs, scoreJob } from '../../src/scoring/match.js';
import { aCandidate, aJob, must, nice } from './fixtures.js';

describe('scoring one job', () => {
  it('returns a score out of 100 with a breakdown of all four dimensions', () => {
    const result = scoreJob(aCandidate(), aJob());
    if (!result.eligible) throw new Error('expected an eligible job');

    expect(result.match.breakdown.map((entry) => entry.dimension)).toEqual([
      'skills',
      'location',
      'salary',
      'experience',
    ]);
    expect(result.match.score).toBeLessThanOrEqual(TOTAL_MAX);
  });

  it('scores a perfect match at 100', () => {
    const job = aJob({
      requiredSkills: [must('TypeScript'), nice('React')],
      location: 'Bengaluru',
      minYearsExperience: 3,
      salaryRangeLpa: { min: 12, max: 20 },
    });

    const result = scoreJob(aCandidate(), job);
    if (!result.eligible) throw new Error('expected an eligible job');
    expect(result.match.score).toBe(100);
  });

  it('returns the total as the sum of its parts, so the breakdown always explains it', () => {
    const result = scoreJob(
      aCandidate(),
      aJob({ location: 'Pune', salaryRangeLpa: { min: 5, max: 9 } }),
    );
    if (!result.eligible) throw new Error('expected an eligible job');

    const summed = result.match.breakdown.reduce((total, entry) => total + entry.earned, 0);
    expect(result.match.score).toBeCloseTo(summed, 5);
  });

  it('reports exclusion with the skills that caused it, rather than a score', () => {
    const job = aJob({ requiredSkills: [must('Kubernetes'), must('Go')] });
    const result = scoreJob(aCandidate(), job);

    expect(result.eligible).toBe(false);
    if (result.eligible) throw new Error('unreachable');
    expect(result.excluded.missingMustHave).toEqual(['Kubernetes', 'Go']);
  });
});

describe('ranking', () => {
  it('returns the best match first', () => {
    const ideal = aJob({
      id: 'ideal',
      location: 'Bengaluru',
      salaryRangeLpa: { min: 12, max: 20 },
    });
    const poor = aJob({ id: 'poor', location: 'Pune', salaryRangeLpa: { min: 4, max: 6 } });

    const ranked = rankJobs(aCandidate(), [poor, ideal]);
    expect(ranked.map((match) => match.jobId)).toEqual(['ideal', 'poor']);
  });

  it('omits ineligible jobs entirely, rather than ranking them last', () => {
    // The excluded job is otherwise perfect — same city, generous salary, ample experience.
    const blocked = aJob({
      id: 'blocked',
      requiredSkills: [must('Kubernetes')],
      salaryRangeLpa: { min: 20, max: 40 },
    });
    const ranked = rankJobs(aCandidate(), [blocked, aJob({ id: 'open' })]);

    expect(ranked.map((match) => match.jobId)).toEqual(['open']);
  });

  it('returns an empty list when nothing is eligible', () => {
    const ranked = rankJobs(aCandidate(), [aJob({ requiredSkills: [must('Kubernetes')] })]);
    // A valid answer, not an error: this candidate passes no gate.
    expect(ranked).toEqual([]);
  });

  it('applies limit to the top of the ranking', () => {
    const jobs = [
      aJob({ id: 'a', salaryRangeLpa: { min: 12, max: 20 } }),
      aJob({ id: 'b', salaryRangeLpa: { min: 9, max: 14 } }),
      aJob({ id: 'c', salaryRangeLpa: { min: 4, max: 6 } }),
    ];
    const ranked = rankJobs(aCandidate(), jobs, { limit: 2 });

    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.jobId).toBe('a');
  });

  it('treats a limit of zero as asking for nothing', () => {
    expect(rankJobs(aCandidate(), [aJob()], { limit: 0 })).toEqual([]);
  });

  it('returns everything when no limit is given', () => {
    const jobs = [aJob({ id: 'a' }), aJob({ id: 'b' }), aJob({ id: 'c' })];
    expect(rankJobs(aCandidate(), jobs)).toHaveLength(3);
  });

  describe('tie-breaking', () => {
    it('prefers the better skills match when totals are equal', () => {
      // Both total 93: one trades 5 skill points for 5 location points.
      const betterSkills = aJob({
        id: 'skills',
        requiredSkills: [must('TypeScript'), nice('React')],
        location: 'Pune',
        remoteAllowed: true,
      });
      const betterLocation = aJob({
        id: 'location',
        requiredSkills: [must('TypeScript'), nice('React'), nice('Go')],
        location: 'Bengaluru',
      });

      const ranked = rankJobs(aCandidate(), [betterLocation, betterSkills]);
      expect(ranked[0]?.score).toBe(ranked[1]?.score);
      expect(ranked[0]?.jobId).toBe('skills');
    });

    it('orders identical jobs deterministically, so repeated requests agree', () => {
      const jobs = [aJob({ id: 'z' }), aJob({ id: 'a' }), aJob({ id: 'm' })];
      const first = rankJobs(aCandidate(), jobs).map((match) => match.jobId);
      const second = rankJobs(aCandidate(), [...jobs].reverse()).map((match) => match.jobId);

      expect(first).toEqual(['a', 'm', 'z']);
      expect(second).toEqual(first);
    });
  });
});
