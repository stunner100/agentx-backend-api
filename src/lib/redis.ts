import { Redis } from 'ioredis';
import 'dotenv/config';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

redis.on('error', (err) => {
    console.error('Redis Error:', err);
});

redis.on('connect', () => {
    console.log('Redis connected successfully');
});
