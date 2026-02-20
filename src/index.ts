import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from './lib/db';
import { postJobQueue, publishJobQueue } from './queues';
import { startScheduler } from './modules/scheduler';
import { pino } from 'pino';
import { statsRoutes } from './api/routes/stats';

const logger = pino({ name: 'FastifyApp' });

const app = Fastify({
    logger: true,
});

// Register CORS for Admin UI (Next.js config)
app.register(cors, {
    origin: '*',
});

app.register(statsRoutes, { prefix: '/stats' });

// GET /health
app.get('/health', async (request, reply) => {
    return { status: 'ok', time: new Date().toISOString() };
});

// ADMIN /config
app.get('/config', async (request, reply) => {
    return {
        postWindows: process.env.POST_WINDOWS,
        timezone: process.env.TIMEZONE,
        globalKillSwitch: process.env.GLOBAL_KILL_SWITCH,
    };
});

app.put('/config', async (request, reply) => {
    // In a real app we'd save to DB or dynamically reload env configs
    const body: any = request.body;
    if (body.globalKillSwitch !== undefined) {
        process.env.GLOBAL_KILL_SWITCH = body.globalKillSwitch.toString();
    }
    return { status: 'updated', globalKillSwitch: process.env.GLOBAL_KILL_SWITCH };
});

// VIDEO INGEST /videos/upsert
app.post('/videos/upsert', async (request, reply) => {
    const data: any = request.body;

    const video = await prisma.video.upsert({
        where: { id: data.id || '' },
        update: { ...data },
        create: { ...data },
    });

    return { status: 'upserted', videoId: video.id };
});

// EVENTS INGEST /events
app.post('/events', async (request, reply) => {
    const data: any = request.body; // { sessionId, utmId, eventType, videoId, ts, metadata }

    const event = await prisma.event.create({
        data: {
            sessionId: data.sessionId,
            eventType: data.eventType,
            utmId: data.utmId,
            videoId: data.videoId,
            metadata: data.metadata,
            ts: data.ts ? new Date(data.ts) : new Date(),
        }
    });

    return { status: 'ingested', eventId: event.id };
});

// STATS /stats/posts
app.get('/stats/posts', async (request, reply) => {
    const posts = await prisma.xPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    return { posts };
});

export async function bootstrap() {
    try {
        // Start Fastify server
        const port = parseInt(process.env.PORT || '3000', 10);
        await app.listen({ port, host: '0.0.0.0' });
        logger.info(`Server listening on port ${port}`);

        // Initialize Scheduler based on node-cron
        startScheduler();

        // Initialize workers here if we intend to run them in same process
        import('./workers/postWorker');
        import('./workers/publishWorker');

    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

// Start immediately if executed directly
if (require.main === module) {
    bootstrap();
}
