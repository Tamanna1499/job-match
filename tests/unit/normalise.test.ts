import { describe, expect, it } from 'vitest';
import { normaliseLocation, normaliseSkill, normaliseSkills } from '../../src/scoring/normalise.js';

describe('skill normalisation', () => {
  it('collapses the same skill written differently', () => {
    for (const written of ['Node.js', 'node js', 'NODEJS', ' NodeJS ', 'node-js']) {
      expect(normaliseSkill(written)).toBe('nodejs');
    }
  });

  it('keeps digits, which are part of real skill names', () => {
    expect(normaliseSkill('ES6')).toBe('es6');
    expect(normaliseSkill('Vue 3')).toBe('vue3');
  });

  it('does not infer synonyms', () => {
    // A curated table would be needed to do this properly; an uncurated one produces
    // false matches, which cost a candidate more than a miss does.
    expect(normaliseSkill('JS')).not.toBe(normaliseSkill('JavaScript'));
  });

  it('builds a set, so duplicates in a candidate profile do not matter', () => {
    const skills = normaliseSkills(['React', 'react', 'REACT ']);
    expect(skills.size).toBe(1);
    expect(skills.has('react')).toBe(true);
  });

  /**
   * A consequence of "alphanumeric characters only", recorded rather than hidden.
   * Stripping every symbol makes C, C++ and C# indistinguishable, so a candidate who
   * knows C matches a job requiring C++. Documented in DECISIONS.md; the fix is a
   * normaliser that preserves a small set of meaningful symbols.
   */
  it('collapses C, C++ and C# together — a known limitation of the rule', () => {
    expect(normaliseSkill('C++')).toBe('c');
    expect(normaliseSkill('C#')).toBe('c');
    expect(normaliseSkill('C')).toBe('c');
  });
});

describe('location normalisation', () => {
  it('treats the same place written differently as one place', () => {
    expect(normaliseLocation('New Delhi')).toBe(normaliseLocation('new delhi'));
    expect(normaliseLocation('Bengaluru ')).toBe('bengaluru');
  });

  it('does not treat different places as the same', () => {
    expect(normaliseLocation('Pune')).not.toBe(normaliseLocation('Mumbai'));
  });
});
