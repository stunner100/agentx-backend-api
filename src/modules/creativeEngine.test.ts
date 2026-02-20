import { describe, it, expect } from 'vitest';
import { calculateJaccardSimilarity, hashText } from './creativeEngine';

describe('Creative Engine - Duplicate Guard Helpers', () => {
    it('should correctly calculate Jaccard Similarity', () => {
        const textA = "Check out this new video release right now";
        const textB = "Check out this new video release right now";

        const textC = "Check out our newest video";

        expect(calculateJaccardSimilarity(textA, textB)).toBe(1);

        const scoreAC = calculateJaccardSimilarity(textA, textC);
        expect(scoreAC).toBeGreaterThan(0.2);
        expect(scoreAC).toBeLessThan(0.7);
    });

    it('should generate consistent SHA256 hashes ignoring case and whitespace', () => {
        const hash1 = hashText('Hello World');
        const hash2 = hashText('hello world ');

        expect(hash1).toBe(hash2);
    });
});
