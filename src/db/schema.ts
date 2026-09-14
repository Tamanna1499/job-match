import { boolean, check, doublePrecision, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The tables behind the two entities in the brief.
 *
 * Years and salaries are `double precision` rather than `numeric` because the domain type
 * is a JS `number` and a double round-trips one exactly. `numeric` would arrive back as a
 * string and need parsing at every read, which is a conversion step that buys nothing here:
 * salaries are in lakhs, a range of roughly 1 to 100.
 */

export const candidates = pgTable(
  'candidates',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** A flat list with no per-item attributes, so an array column says it exactly. */
    skills: text('skills').array().notNull(),
    yearsOfExperience: doublePrecision('years_of_experience').notNull(),
    location: text('location').notNull(),
    expectedSalaryLpa: doublePrecision('expected_salary_lpa').notNull(),
  },
  (table) => [
    check('candidates_experience_non_negative', sql`${table.yearsOfExperience} >= 0`),
    check('candidates_salary_positive', sql`${table.expectedSalaryLpa} > 0`),
  ],
);

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    minYearsExperience: doublePrecision('min_years_experience').notNull(),
    location: text('location').notNull(),
    salaryMinLpa: doublePrecision('salary_min_lpa').notNull(),
    salaryMaxLpa: doublePrecision('salary_max_lpa').notNull(),
    remoteAllowed: boolean('remote_allowed').notNull(),
  },
  (table) => [
    check('jobs_experience_non_negative', sql`${table.minYearsExperience} >= 0`),
    check('jobs_salary_positive', sql`${table.salaryMinLpa} > 0`),
    /**
     * An inverted range would make the salary rule incoherent: the gap is measured from
     * the floor, and the "can this job reach the expectation" test reads the ceiling.
     */
    check('jobs_salary_range_ordered', sql`${table.salaryMaxLpa} >= ${table.salaryMinLpa}`),
  ],
);

/**
 * Required skills live in their own table so `must_have` is a typed, NOT NULL column.
 *
 * It is the hard filter — the one rule in the brief that removes a job from the results
 * entirely — and a rule that load-bearing is worth the database stating rather than
 * burying inside a JSON document.
 */
export const jobRequiredSkills = pgTable(
  'job_required_skills',
  {
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    skill: text('skill').notNull(),
    mustHave: boolean('must_have').notNull(),
  },
  (table) => [
    /** One row per skill per job: a job cannot list React as both must-have and not. */
    primaryKey({ columns: [table.jobId, table.skill] }),
  ],
);
