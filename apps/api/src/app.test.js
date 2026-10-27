import test from 'node:test';
import assert from 'node:assert/strict';

// This integration smoke test is opt-in because importing the Express app initializes
// the Mongo-backed session store. Unit tests remain runnable without infrastructure.
if (process.env.RUN_INTEGRATION_TESTS === '1') {
  test('health endpoint returns a healthy status', async () => {
    const { app } = await import('./app.js');
    const server = app.listen(0);
    try {
      const { port } = server.address();
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.status, 'ok');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
}
