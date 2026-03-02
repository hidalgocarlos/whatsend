import Redis from 'ioredis';

let client = null;

export function getRedis() {
  if (!client) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    client = new Redis(url, {
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });
    client.on('error', (err) => console.error('[Redis]', err.message));
  }
  return client;
}
