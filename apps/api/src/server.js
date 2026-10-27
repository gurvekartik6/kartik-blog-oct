import { app, initializeApp } from './app.js';
import { connectDatabase } from './db.js';
import { env } from './config/env.js';
import { newsletterQueue } from './services/queue.js';

await connectDatabase();
await initializeApp();
const server = app.listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await newsletterQueue.close().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
