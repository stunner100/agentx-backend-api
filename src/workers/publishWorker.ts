import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { QUEUE_NAMES } from '../queues';
import { postTweet, uploadMedia } from '../lib/xClient';
import { prisma } from '../lib/db';
import { pino } from 'pino';

const logger = pino({ name: 'PublishWorker' });

export const publishWorker = new Worker(
    QUEUE_NAMES.PUBLISH_JOB,
    async (job: Job) => {
        logger.info(`Processing PublishJob ${job.id}`);

        const { xPostDbId, mediaRef, text, utmId } = job.data;
        logger.info(`Publishing to X for post DB ID: ${xPostDbId}`);

        try {
            let mediaIds: string[] = [];

            if (mediaRef) {
                logger.info(`Uploading media to X: ${mediaRef}`);
                const mediaId = await uploadMedia(mediaRef, 'video/mp4');
                mediaIds.push(mediaId);
                logger.info(`Media uploaded successfully. X Media ID: ${mediaId}`);
            }

            const finalCopy = `${text}\n${utmId}`;
            logger.info('Executing post logic via xClient...');

            const result = await postTweet(finalCopy, mediaIds);

            // Update Database upon success
            await prisma.xPost.update({
                where: { id: xPostDbId },
                data: {
                    status: 'POSTED',
                    xPostId: result.id,
                    postedAt: new Date(),
                }
            });

            logger.info(`Successfully posted to X! Post ID: ${result.id}`);
            return { status: 'success', xPostId: result.id };
        } catch (error: any) {
            logger.error(`Failed to execute publish job: ${error.message}`);

            await prisma.xPost.update({
                where: { id: xPostDbId },
                data: {
                    status: 'FAILED',
                    errorCode: error.code?.toString() || 'UNKNOWN_ERROR',
                    errorMessage: error.message
                }
            });

            throw error; // Re-throw for BullMQ retry bounds
        }
    },
    {
        connection: redis as any,
        concurrency: 1, // Rate-limit compliance (sequential posting)
    }
);

publishWorker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
});

publishWorker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed: ${err.message}`);
});
