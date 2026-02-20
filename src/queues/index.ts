import { Queue } from 'bullmq';
import { redis } from '../lib/redis';

export const QUEUE_NAMES = {
    POST_JOB: 'post-job-queue',
    PUBLISH_JOB: 'publish-job-queue',
};

export const postJobQueue = new Queue(QUEUE_NAMES.POST_JOB, {
    connection: redis as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

export const publishJobQueue = new Queue(QUEUE_NAMES.PUBLISH_JOB, {
    connection: redis as any,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 10000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});
