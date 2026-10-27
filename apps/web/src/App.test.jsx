import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './lib/api.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('apiRequest', () => {
  it('sends credentials and JSON headers for JSON requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: 'ok' })
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await apiRequest('/api/example', { method: 'POST', body: JSON.stringify({ value: 1 }) });
    expect(result).toEqual({ message: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/example'), expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' })
    }));
  });

  it('surfaces API error messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid request data.' })
    }));
    await expect(apiRequest('/api/example')).rejects.toThrow('Invalid request data.');
  });
});
