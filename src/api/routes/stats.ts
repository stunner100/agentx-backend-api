import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/db';

export async function statsRoutes(fastify: FastifyInstance) {
    // GET /stats/posts/metrics
    fastify.get('/posts/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const [total, successful, failed, blocked] = await Promise.all([
                prisma.xPost.count(),
                prisma.xPost.count({ where: { status: 'POSTED' } }),
                prisma.xPost.count({ where: { status: 'FAILED' } }),
                prisma.xPost.count({ where: { status: 'BLOCKED' } }),
            ]);

            return reply.send({
                total,
                successful,
                failed,
                blocked,
            });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch metrics' });
        }
    });

    // GET /stats/posts/recent
    fastify.get('/posts/recent', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const posts = await prisma.xPost.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    video: { select: { title: true } },
                    variant: { select: { text: true } }
                }
            });

            return reply.send(posts);
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch recent posts' });
        }
    });
}
