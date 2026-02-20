import { createHash } from 'crypto';

export interface TemplateOptions {
    title: string;
    category: string;
    tags: string[];
}

const TEMPLATES = [
    "New release! Check out {title}. [18+ only]",
    "Just dropped: {title} in {category}. Watch now! 🔞",
    "Don't miss our latest update: {title}. Link below!",
    "Trending right now in {category}: {title}. 🌶️",
];

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-fake-local-key',
});

// Helper to pick random item
const sample = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export async function generateTextVariant(options: TemplateOptions): Promise<string> {
    try {
        const prompt = `You are a social media manager for an 18+ promoter account. Write a short, highly engaging promotional tweet for a video titled "${options.title}" in the "${options.category}" category. Tags: ${options.tags?.join(', ')}. Keep it under 200 characters. You MUST include the exact string "[18+ only]" somewhere in the tweet. Do not use hashtags. Just return the text.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 100,
            temperature: 0.8,
        });

        const text = response.choices[0]?.message?.content?.trim();
        if (text && text.length > 5 && text.includes('[18+ only]')) {
            return text;
        }
        throw new Error('LLM output invalid or missing tags');
    } catch (e) {
        // Fallback to static templates if rate limited or invalid
        console.warn('OpenAI generation failed or was invalid, falling back to static templates:', e);
        const template = sample(TEMPLATES);
        return template
            .replace('{title}', options.title)
            .replace('{category}', options.category || 'exclusive');
    }
}

export function hashText(text: string): string {
    return createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
}

// Very simple word-level Jaccard similarity for the Duplicate Guard
export function calculateJaccardSimilarity(textA: string, textB: string): number {
    const setA = new Set(textA.toLowerCase().split(/\W+/).filter(w => w.length > 0));
    const setB = new Set(textB.toLowerCase().split(/\W+/).filter(w => w.length > 0));

    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
}
