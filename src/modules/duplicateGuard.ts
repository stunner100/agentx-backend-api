import { prisma } from '../lib/db';
import { calculateJaccardSimilarity, hashText } from './creativeEngine';
import { pino } from 'pino';

const logger = pino({ name: 'DuplicateGuard' });

const SIMILARITY_THRESHOLD = 0.7;
const RECENCY_DAYS = 7;

export async function checkDuplicate(text: string, mediaRef?: string): Promise<boolean> {
    const textHash = hashText(text);

    // 1. Exact hash match in recent history
    const recentPosts = await prisma.xPost.findMany({
        where: {
            status: 'POSTED',
            createdAt: {
                gte: new Date(Date.now() - RECENCY_DAYS * 24 * 60 * 60 * 1000)
            }
        },
        include: { variant: true }
    });

    for (const post of recentPosts) {
        // Media Reuse check
        if (mediaRef && post.mediaAssetRef === mediaRef) {
            logger.warn(`Media ${mediaRef} was already used in post ${post.id}. Blocking.`);
            return true; // Is duplicate
        }

        // Exact text hash
        if (post.variant.textHash === textHash) {
            logger.warn(`Text exact hash matched post ${post.id}. Blocking.`);
            return true;
        }

        // Similarity check
        const similarity = calculateJaccardSimilarity(text, post.variant.text);
        if (similarity >= SIMILARITY_THRESHOLD) {
            logger.warn(`Text similarity (${similarity.toFixed(2)}) is above threshold with post ${post.id}. Blocking.`);
            return true;
        }
    }

    return false; // Not a duplicate
}
