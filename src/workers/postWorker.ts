import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { QUEUE_NAMES, publishJobQueue } from '../queues';
import { generateClip } from '../modules/mediaProcessor';
import { selectCandidateForPost, generateUtmUrl } from '../modules/selector';
import { generateTextVariant, TemplateOptions } from '../modules/creativeEngine';
import { checkDuplicate } from '../modules/duplicateGuard';
import { isCircuitOpen } from '../lib/circuitBreaker';
import { pino } from 'pino';
import path from 'path';

const logger = pino({ name: 'PostWorker' });

export const postWorker = new Worker(
    QUEUE_NAMES.POST_JOB,
    async (job: Job) => {
        logger.info(`Processing PostJob ${job.id}`);
        const { jobKey, scheduledTime } = job.data;

        if (isCircuitOpen()) {
            logger.warn(`Circuit Breaker is open or Kill Switch is active. Aborting Job ${job.id}.`);
            return { status: 'aborted', reason: 'circuit_open' };
        }

        logger.info(`Selecting candidate for Slot: ${jobKey} at ${scheduledTime}`);
        const candidate = await selectCandidateForPost();

        if (!candidate) {
            logger.warn('No eligible candidates found for posting.');
            return { status: 'skipped', reason: 'no_candidate' };
        }

        logger.info(`Selected Candidate: [${candidate.id}] ${candidate.title}`);

        const options: TemplateOptions = {
            title: candidate.title,
            category: candidate.category || 'General',
            tags: candidate.tags,
        };

        const generatedText = await generateTextVariant(options);
        logger.info('Generated promotional text via Creative Engine.');

        const isDuplicate = await checkDuplicate(generatedText, candidate.thumbnailUrl || undefined);
        if (isDuplicate) {
            logger.warn('Candidate rejected by duplicate guard.');
            return { status: 'skipped', reason: 'duplicate_detected' };
        }

        const utmId = generateUtmUrl(
            candidate.url,
            'agentx_daily',
            candidate.id,
            candidate.category || 'none'
        );

        // Process Media via FFMPEG
        let mediaRef: string | undefined = undefined;
        try {
            // For now, if there's no real raw video path on the candidate, we fall back to the test asset.
            // In a production system, `candidate.url` points directly to the Cloudflare bucket URL
            const sourcePath = candidate.url ? candidate.url : path.resolve(process.cwd(), 'scripts', 'assets', 'test.mp4');
            logger.info(`Staging media via FFMPEG pipeline from: ${sourcePath}`);
            mediaRef = await generateClip(sourcePath, `teaser-${jobKey}.mp4`);
            logger.info(`Media successfully prepared: ${mediaRef}`);
        } catch (e) {
            logger.warn(`Failed to process media, proceeding text-only: ${e}`);
        }

        logger.info(`Enqueuing PublishJob with mediaRef: ${mediaRef}`);
        await publishJobQueue.add('publish', {
            xPostDbId: candidate.id, // For now passing videoId as reference
            mediaRef,
            text: generatedText,
            utmId
        });

        return { status: 'success', jobKey };
    },
    {
        connection: redis as any,
        concurrency: 5,
    }
);

postWorker.on('completed', (job) => {
    logger.info(`PostJob ${job.id} completed successfully`);
});

postWorker.on('failed', (job, err) => {
    logger.error(`PostJob ${job?.id} failed: ${err.message}`);
});
