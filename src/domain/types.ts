/**
 * The entities the scorer reasons about, and the shape of what it returns.
 *
 * Salary is expressed in lakhs per annum, and the unit is in the field name. The scoring
 * specification is written in lakhs — "gap <= 2" means two lakh — so storing anything
 * else would mean converting at every comparison, which is where unit bugs live.
 */
export interface Candidate {
  readonly id: string;
  readonly name: string;
  readonly skills: readonly string[];
  readonly yearsOfExperience: number;
  readonly location: string;
  readonly expectedSalaryLpa: number;
}

export interface RequiredSkill {
  readonly skill: string;
  readonly mustHave: boolean;
}

export interface SalaryRangeLpa {
  readonly min: number;
  readonly max: number;
}

export interface Job {
  readonly id: string;
  readonly title: string;
  readonly requiredSkills: readonly RequiredSkill[];
  readonly minYearsExperience: number;
  readonly location: string;
  readonly salaryRangeLpa: SalaryRangeLpa;
  readonly remoteAllowed: boolean;
}

export const DIMENSIONS = ['skills', 'location', 'salary', 'experience'] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/**
 * One dimension's contribution. `reason` is built from the same values that produced
 * `earned`, so an explanation cannot drift from the score it describes.
 */
export interface DimensionScore {
  readonly dimension: Dimension;
  readonly earned: number;
  readonly max: number;
  readonly reason: string;
}

export interface JobMatch {
  readonly jobId: string;
  readonly score: number;
  readonly breakdown: readonly DimensionScore[];
}

/**
 * The only logging surface the lower layers are given.
 *
 * Storage should not decide where a message goes — the server owns that. Passing this in
 * keeps `db/` free of a logger dependency and lets a test assert on what was logged.
 */
export interface Logger {
  error(message: string): void;
}

/**
 * What a caller supplies when creating an entity.
 *
 * The id is not among the fields: the server mints it and returns it, so a client cannot
 * collide with an existing record or choose an id that means something elsewhere.
 */
export type NewCandidate = Omit<Candidate, 'id'>;
export type NewJob = Omit<Job, 'id'>;
