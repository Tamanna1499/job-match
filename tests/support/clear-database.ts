import type { Database } from '../../src/db/client.js';
import { candidates, jobRequiredSkills, jobs } from '../../src/db/schema.js';

export async function clearTestTables(database: Database): Promise<void> {
  await database.delete(jobRequiredSkills);
  await database.delete(jobs);
  await database.delete(candidates);
}
