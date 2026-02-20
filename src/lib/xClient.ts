import { TwitterApi, SendTweetV2Params } from 'twitter-api-v2';
import 'dotenv/config';

// Initialize the client
// Assumes OAuth 2.0 or 1.0a User Context
export const xClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY || '',
    appSecret: process.env.TWITTER_API_SECRET || '',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
});

// Wrapper functions for resilience and rate limit checks
export async function postTweet(text: string, mediaIds?: string[]) {
    const payload: SendTweetV2Params = { text };
    if (mediaIds && mediaIds.length > 0) {
        // twitter-api-v2 SendTweetV2Params expects a very strict union array `[string] | [string, string] | ...` 
        // up to 4 elements. Since we know we are usually sending 1, we can simply pass it as a 1-tuple or cast to any
        payload.media = { media_ids: [mediaIds[0]] as [string] };
    }

    try {
        const { data } = await xClient.v2.tweet(payload);
        return data;
    } catch (error: any) {
        if (error.code === 429) {
            throw new Error(`Rate limit exceeded on X API: ${error.message}`);
        }
        throw error;
    }
}

export async function uploadMedia(filePath: string, mimeType?: string) {
    try {
        const mediaId = await xClient.v1.uploadMedia(filePath, { mimeType });
        return mediaId;
    } catch (error: any) {
        throw new Error(`Failed to upload media to X: ${error.message}`);
    }
}
