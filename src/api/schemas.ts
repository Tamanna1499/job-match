import { z } from 'zod';
import { normaliseSkill } from '../scoring/normalise.js';

const text = z.string().trim().min(1).max(200);
const skill = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => normaliseSkill(value).length > 0, 'Skill must contain a letter or digit');
const nonNegative = z.number().finite().min(0);
const positive = z.number().finite().positive();

export const candidateBody = z.strictObject({
  name: text,
  skills: z.array(skill).max(100),
  yearsOfExperience: nonNegative,
  location: text,
  expectedSalaryLpa: positive,
});

export const jobBody = z.strictObject({
  title: text,
  requiredSkills: z
    .array(z.strictObject({ skill, mustHave: z.boolean() }))
    .max(100)
    .superRefine((requirements, context) => {
      const seen = new Set<string>();
      for (const [index, requirement] of requirements.entries()) {
        const key = normaliseSkill(requirement.skill);
        if (seen.has(key)) {
          context.addIssue({
            code: 'custom',
            path: [index, 'skill'],
            message: 'A skill may only be listed once',
          });
        }
        seen.add(key);
      }
    }),
  minYearsExperience: nonNegative,
  location: text,
  salaryRangeLpa: z
    .strictObject({ min: positive, max: positive })
    .refine((range) => range.max >= range.min, {
      path: ['max'],
      message: 'Salary maximum must be at least the minimum',
    }),
  remoteAllowed: z.boolean(),
});

export const recommendationParams = z.strictObject({ id: z.string().min(1) });
export const recommendationQuery = z.strictObject({
  limit: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(100))
    .optional()
    .default(10),
});
