import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { pino } from 'pino';

const logger = pino({ name: 'MediaProcessor' });

/**
 * Extracts a ~15 second teaser clip from a source video and constraints the output to X API limits.
 * @param sourcePath Absolute or relative path to the original full-length video
 * @param outputFilename The desired name of the generated file (e.g., 'teaser-123.mp4')
 * @returns The absolute path to the generated localized clip
 */
export async function generateClip(sourcePath: string, outputFilename: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const isUrl = sourcePath.startsWith('http://') || sourcePath.startsWith('https://');
        if (!isUrl && !fs.existsSync(sourcePath)) {
            return reject(new Error(`Source file not found: ${sourcePath}`));
        }

        const outDir = path.resolve(process.cwd(), 'tmp');
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        const targetPath = path.resolve(outDir, outputFilename);

        logger.info(`Starting FFMPEG processing for ${sourcePath} -> ${targetPath}`);

        ffmpeg(sourcePath)
            // Extract a snippet (e.g. from 10 seconds in, lasting 15 seconds)
            // In a production app, we could randomize this start time based on video length
            .setStartTime(15)
            .setDuration(15)
            // Enforce X API Compliant formatting
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions([
                '-pix_fmt yuv420p',
                '-preset fast',
                '-b:v 2000k', // 2 Mbps max bitrate
                '-maxrate 2500k',
                '-bufsize 5000k',
                '-vf scale=-2:720' // Scale safely to exactly 720p height, preserving aspect ratio cleanly
            ])
            .on('end', () => {
                logger.info(`FFMPEG processing completed for ${outputFilename}`);
                resolve(targetPath);
            })
            .on('error', (err) => {
                logger.error(`FFMPEG processing failed: ${err.message}`);
                reject(err);
            })
            .save(targetPath);
    });
}
