import { describe, it, expect, vi } from 'vitest';

// Mock DB before importing selector to prevent PrismaClient from initializing
vi.mock('../lib/db', () => ({
    prisma: {},
}));

import { generateUtmUrl } from './selector';

describe('Selector - UTM Builder', () => {
    it('should correctly format a UTM URL', () => {
        const destination = "https://example.com/video/123";
        const result = generateUtmUrl(destination, 'daily_burst', 'variant_abc', '18plus');

        expect(result).toContain('utm_source=x');
        expect(result).toContain('utm_medium=social');
        expect(result).toContain('utm_campaign=daily_burst');
        expect(result).toContain('utm_content=variant_abc');
        expect(result).toContain('utm_term=18plus');
        expect(result.startsWith(destination)).toBe(true);
    });
});
