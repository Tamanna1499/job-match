import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { candidates, jobRequiredSkills, jobs } from '../db/schema.js';
import type { Candidate, Job, NewCandidate, NewJob, RequiredSkill } from '../domain/types.js';
import type { Repositories } from './types.js';

/**
 * The PostgreSQL implementation of the repository interfaces.
 *
 * Every function in here is a translation between two shapes: rows, which are flat and
 * column-named, and domain entities, which are nested and camel-cased. Keeping that
 * translation in one directory is what allows the rest of the code to be written as if
 * the database did not exist.
 */

type JobRow = typeof jobs.$inferSelect;
type SkillRow = typeof jobRequiredSkills.$inferSelect;
type CandidateRow = typeof candidates.$inferSelect;

function toCandidate(row: CandidateRow): Candidate {
  return {
    id: row.id,
    name: row.name,
    skills: row.skills,
    yearsOfExperience: row.yearsOfExperience,
    location: row.location,
    expectedSalaryLpa: row.expectedSalaryLpa,
  };
}

function toJob(row: JobRow, skills: readonly RequiredSkill[]): Job {
  return {
    id: row.id,
    title: row.title,
    requiredSkills: skills,
    minYearsExperience: row.minYearsExperience,
    location: row.location,
    salaryRangeLpa: { min: row.salaryMinLpa, max: row.salaryMaxLpa },
    remoteAllowed: row.remoteAllowed,
  };
}

/**
 * Groups skill rows by job id.
 *
 * Jobs and their skills are fetched as two queries rather than one join. A join would
 * return the job's columns repeated once per skill, and the de-duplication needed to undo
 * that is more code than a second query — which the database answers from the primary key.
 */
function groupSkills(rows: readonly SkillRow[]): Map<string, RequiredSkill[]> {
  const grouped = new Map<string, RequiredSkill[]>();
  for (const row of rows) {
    const existing = grouped.get(row.jobId);
    const skill: RequiredSkill = { skill: row.skill, mustHave: row.mustHave };
    if (existing === undefined) grouped.set(row.jobId, [skill]);
    else existing.push(skill);
  }
  return grouped;
}

export function createRepositories(database: Database): Repositories {
  return {
    candidates: {
      async create(candidate: NewCandidate): Promise<Candidate> {
        const row: CandidateRow = {
          id: randomUUID(),
          name: candidate.name,
          skills: [...candidate.skills],
          yearsOfExperience: candidate.yearsOfExperience,
          location: candidate.location,
          expectedSalaryLpa: candidate.expectedSalaryLpa,
        };
        await database.insert(candidates).values(row);
        return toCandidate(row);
      },

      async findById(id: string): Promise<Candidate | undefined> {
        const found = await database.select().from(candidates).where(eq(candidates.id, id)).limit(1);
        const row = found[0];
        return row === undefined ? undefined : toCandidate(row);
      },
    },

    jobs: {
      async create(job: NewJob): Promise<Job> {
        const id = randomUUID();
        const row: JobRow = {
          id,
          title: job.title,
          minYearsExperience: job.minYearsExperience,
          location: job.location,
          salaryMinLpa: job.salaryRangeLpa.min,
          salaryMaxLpa: job.salaryRangeLpa.max,
          remoteAllowed: job.remoteAllowed,
        };

        /**
         * A job and its required skills are one fact, and the must-have flags are the
         * hard filter. A job that committed without them would not be a partial record —
         * it would be a job every candidate is eligible for, silently.
         */
        await database.transaction(async (tx) => {
          await tx.insert(jobs).values(row);
          if (job.requiredSkills.length > 0) {
            await tx.insert(jobRequiredSkills).values(
              job.requiredSkills.map((required) => ({
                jobId: id,
                skill: required.skill,
                mustHave: required.mustHave,
              })),
            );
          }
        });

        return toJob(row, job.requiredSkills);
      },

      async findAll(): Promise<readonly Job[]> {
        /** Ordered by id so an unranked read is reproducible between identical calls. */
        const rows = await database.select().from(jobs).orderBy(jobs.id);
        if (rows.length === 0) return [];

        const skillRows = await database
          .select()
          .from(jobRequiredSkills)
          .where(
            inArray(
              jobRequiredSkills.jobId,
              rows.map((row) => row.id),
            ),
          );

        const skills = groupSkills(skillRows);
        return rows.map((row) => toJob(row, skills.get(row.id) ?? []));
      },
    },
  };
}
