import { prisma } from '../lib/db';
import { pino } from 'pino';

const logger = pino({ name: 'Selector' });

export async function selectCandidateForPost() {
    // 1. Fetch eligible candidates
    // Hard gates: adult18plus=true, consentVerified=true, suspectedIllegal=false
    // Not checking blocklists here for simplicity, but could join on PolicyDecisions
    const candidates = await prisma.video.findMany({
        where: {
            adult18plus: true,
            consentVerified: true,
            suspectedIllegal: false,
        },
        include: {
            xPosts: {
                orderBy: {
                    createdAt: 'desc'
                },
                take: 1
            }
        }
    });

    if (!candidates || candidates.length === 0) {
        logger.warn('No eligible candidates found.');
        return null;
    }

    // 2. Score candidates
    const scoredCandidates = candidates.map(video => {
        let score = 0;

        // Recency (Decay over 7 days)
        const ageMs = Date.now() - new Date(video.publishedAt).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 10 - ageDays) * 2; // Weight A = 2
        score += recencyScore;

        // Fatigue penalty (posted in last 48h)
        const lastPost = video.xPosts[0];
        if (lastPost) {
            const timeSincePost = Date.now() - new Date(lastPost.createdAt).getTime();
            const hoursSincePost = timeSincePost / (1000 * 60 * 60);
            if (hoursSincePost < 48) {
                score -= 50; // Heavy penalty
            }
        }

        // Performance (mock stats)
        const stats: any = video.stats || { ctr: 0, conv: 0 };
        score += (stats.ctr * 10 || 0);

        return { video, score };
    });

    // 3. Sort by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 4. Exploration vs Exploitation (30% random among top quartile)
    const isExploration = Math.random() < 0.3;
    let selected = scoredCandidates[0].video;

    if (isExploration && scoredCandidates.length > 4) {
        const quartileSize = Math.floor(scoredCandidates.length / 4);
        const randomIndex = Math.floor(Math.random() * quartileSize);
        selected = scoredCandidates[randomIndex].video;
        logger.debug('Exploration mode picked random top-quartile candidate.');
    } else {
        logger.debug('Exploitation mode picked top candidate.');
    }

    return selected;
}

export function generateUtmUrl(destination: string, campaign: string, content: string, term?: string): string {
    const url = new URL(destination);
    url.searchParams.append('utm_source', 'x');
    url.searchParams.append('utm_medium', 'social');
    url.searchParams.append('utm_campaign', campaign);
    url.searchParams.append('utm_content', content);
    if (term) url.searchParams.append('utm_term', term);
    return url.toString();
}
