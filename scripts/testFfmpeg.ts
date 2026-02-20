import { generateClip } from '../src/modules/mediaProcessor';
import path from 'path';
import fs from 'fs';

async function testPipeline() {
    const assetsDir = path.resolve(__dirname, 'assets');
    const sourcePath = path.resolve(assetsDir, 'test.mp4');

    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Creating a dummy file if testing without a real media asset first
    if (!fs.existsSync(sourcePath)) {
        console.log('No test.mp4 found. Please add scripts/assets/test.mp4 to test FFMPEG fully.');
        return;
    }

    try {
        console.log(`Sending to Media Processor: ${sourcePath}`);
        const result = await generateClip(sourcePath, `test-teaser-${Date.now()}.mp4`);
        console.log(`Success! File written to: ${result}`);

        const stats = fs.statSync(result);
        console.log(`Generated file size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    } catch (e) {
        console.error('Test failed', e);
    }
}

testPipeline();
