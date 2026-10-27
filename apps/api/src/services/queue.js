import { Queue } from 'bullmq';
import { env } from '../config/env.js';

export const redisConnection = (() => {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {})
  };
})();

let queueInstance;
function getQueue() {
  if (!queueInstance) {
    queueInstance = new Queue('newsletter', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 5000 }
      }
    });
  }
  return queueInstance;
}

// Lazy initialization lets API health checks and unit tests run without Redis being available.
export const newsletterQueue = {
  add: (...args) => getQueue().add(...args),
  async close() {
    if (queueInstance) {
      const current = queueInstance;
      queueInstance = undefined;
      await current.close();
    }
  }
};
