import type { Candidate, Job, RequiredSkill } from '../../src/domain/types.js';

/** A capable candidate in Bengaluru expecting ₹12 LPA — the scale the spec was written against. */
export function aCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c-1',
    name: 'Test Candidate',
    skills: ['TypeScript', 'React', 'Node.js'],
    yearsOfExperience: 5,
    location: 'Bengaluru',
    expectedSalaryLpa: 12,
    ...overrides,
  };
}

export function aJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'j-1',
    title: 'Backend Engineer',
    requiredSkills: [must('TypeScript'), nice('React')],
    minYearsExperience: 3,
    location: 'Bengaluru',
    salaryRangeLpa: { min: 10, max: 15 },
    remoteAllowed: false,
    ...overrides,
  };
}

export const must = (skill: string): RequiredSkill => ({ skill, mustHave: true });
export const nice = (skill: string): RequiredSkill => ({ skill, mustHave: false });
