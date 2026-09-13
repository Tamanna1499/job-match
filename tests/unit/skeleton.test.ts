import { describe, expect, it } from 'vitest';
import { main } from '../../src/server.js';

describe('skeleton', () => {
  it('has a wired entry point that is not yet implemented', () => {
    expect(() => main()).toThrow('not implemented');
  });
});
