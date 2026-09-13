/**
 * Reduces a skill to a comparable form: lowercase, alphanumeric characters only.
 *
 * `Node.js`, `node js` and `NODEJS` all collapse to `nodejs`, which is the point — the
 * same skill written three ways should match.
 *
 * No synonyms are inferred. `JS` will not match `JavaScript`, and that is deliberate:
 * a synonym table needs curating, and an uncurated one produces false matches, which are
 * worse than misses. A candidate wrongly shown a job they cannot do loses more than one
 * who simply never sees it.
 */
export function normaliseSkill(skill: string): string {
  return skill.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normaliseSkills(skills: readonly string[]): ReadonlySet<string> {
  return new Set(skills.map(normaliseSkill));
}

/** Locations are compared the same way, so "New Delhi" and "new delhi" are one place. */
export function normaliseLocation(location: string): string {
  return location.toLowerCase().replace(/[^a-z0-9]/g, '');
}
