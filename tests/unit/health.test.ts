import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/app.js';

describe('health endpoint', () => {
  it('returns 503 when the database cannot answer', async () => {
    const app = createApp({ check: vi.fn().mockResolvedValue(false) });

    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ status: 'unavailable' });
      expect(response.body).not.toContain('database');
    } finally {
      await app.close();
    }
  });
});
