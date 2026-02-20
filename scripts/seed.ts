import { prisma } from '../src/lib/db';
import { hashText } from '../src/modules/creativeEngine';

async function main() {
    console.log('Cleaning database...');
    await prisma.xPost.deleteMany({});
    await prisma.variant.deleteMany({});
    await prisma.video.deleteMany({});
    await prisma.utmLink.deleteMany({});
    await prisma.event.deleteMany({});

    console.log('Seeding videos...');

    // 1. A highly eligible, recent video with great performance (Should be top pick)
    const video1 = await prisma.video.create({
        data: {
            url: 'https://example.com/v/top-pick',
            title: 'Exclusive Studio BTS [18+]',
            category: 'Studio',
            tags: ['bts', 'exclusive', '1080p'],
            publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
            adult18plus: true,
            consentVerified: true,
            suspectedIllegal: false,
            thumbnailUrl: 'https://example.com/assets/thumb1.jpg',
            stats: { ctr: 0.15, conv: 0.05 },
        }
    });

    // 2. An older video with okay performance
    const video2 = await prisma.video.create({
        data: {
            url: 'https://example.com/v/older-video',
            title: 'Amateur Compilation Vol 4',
            category: 'Amateur',
            tags: ['compilation', 'amateur', 'hd'],
            publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
            adult18plus: true,
            consentVerified: true,
            suspectedIllegal: false,
            thumbnailUrl: 'https://example.com/assets/thumb2.jpg',
            stats: { ctr: 0.08, conv: 0.02 },
        }
    });

    // 3. A video that should be BLOCKED (No consent verification)
    await prisma.video.create({
        data: {
            url: 'https://example.com/v/blocked-video',
            title: 'Shaky Cam Unverified',
            category: 'Amateur',
            tags: ['unverified'],
            publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
            adult18plus: true,
            consentVerified: false, // FLAG!
            suspectedIllegal: false,
            thumbnailUrl: 'https://example.com/assets/thumb3.jpg',
        }
    });

    // 4. A video that suffers from "Fatigue" (Posted very recently)
    const videoFatigued = await prisma.video.create({
        data: {
            url: 'https://example.com/v/fatigued-video',
            title: 'POV Experience 4K',
            category: 'POV',
            tags: ['pov', '4k'],
            publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
            adult18plus: true,
            consentVerified: true,
            suspectedIllegal: false,
            thumbnailUrl: 'https://example.com/assets/thumb4.jpg',
            stats: { ctr: 0.12, conv: 0.03 },
        }
    });

    console.log('Seeding historical posts/variants to simulate fatigue & duplicate gates...');

    const duplicateText = "Don't miss our latest update: POV Experience 4K. Link below!";

    const variant1 = await prisma.variant.create({
        data: {
            videoId: videoFatigued.id,
            text: duplicateText,
            textHash: hashText(duplicateText),
            style: 'direct',
            usedCount: 1,
            lastUsedAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
        }
    });

    await prisma.xPost.create({
        data: {
            jobKey: '2023-10-01|0|0',
            videoId: videoFatigued.id,
            variantId: variant1.id,
            status: 'POSTED',
            mediaAssetRef: videoFatigued.thumbnailUrl,
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
            postedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
        }
    });

    console.log('Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
