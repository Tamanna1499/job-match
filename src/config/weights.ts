/**
 * Every number the scorer uses, named and in one place.
 *
 * Specified in Scoring-logic.md, which is authoritative. Keeping them here means no
 * numeric literal appears in scoring/ that a reader would have to interpret, and it makes
 * the "configurable weights" bonus a matter of passing a different object rather than a
 * rewrite.
 */
export const DIMENSION_MAX = {
  skills: 50,
  location: 25,
  salary: 15,
  experience: 10,
} as const;

/** Clearing the must-have bar is worth 40; exceeding it with nice-to-haves, the other 10. */
export const SKILLS = {
  mustHaveShare: 40,
  niceToHaveShare: 10,
} as const;

export const LOCATION = {
  exactMatch: 25,
  remoteAllowed: 20,
  /** Never zero: a mismatched job ranks far down but stays visible. Relocation is the candidate's call. */
  mismatch: 8,
} as const;

/**
 * `gap` is how far above the range's floor the expectation sits, in lakhs. Bands are
 * absolute and calibrated for roughly ₹5–25 LPA; the README records that assumption.
 * Ordered widest-fit-last — the first band whose limit the gap does not exceed wins.
 */
export const SALARY = {
  /** The range cannot reach the expectation. Flat, and near zero by design. */
  cannotMeetExpectation: 3,
  bands: [
    { maxGapLpa: 2, points: 15 },
    { maxGapLpa: 3, points: 12 },
    { maxGapLpa: 4, points: 10 },
  ],
  /** Gap beyond the widest band: the expectation sits near the ceiling. */
  beyondBands: 8,
} as const;

export const EXPERIENCE = {
  meetsMinimum: 10,
  /** Inclusive: a shortfall of up to one year, so six months short scores here too. */
  withinOneYearBelow: 8,
  furtherBelow: 5,
} as const;

export const TOTAL_MAX =
  DIMENSION_MAX.skills + DIMENSION_MAX.location + DIMENSION_MAX.salary + DIMENSION_MAX.experience;
