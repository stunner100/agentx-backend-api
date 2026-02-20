import { CronJob } from 'cron';
import { pino } from 'pino';
import { postJobQueue } from '../queues';
import 'dotenv/config';

const logger = pino({ name: 'Scheduler' });

// Parses process.env.POST_WINDOWS like "09:00,14:00,19:00"
function parseWindows(): string[] {
    const windowsStr = process.env.POST_WINDOWS || '12:00';
    return windowsStr.split(',').map(s => s.trim());
}

export function startScheduler() {
    const windows = parseWindows();
    const timezone = process.env.TIMEZONE || 'UTC';

    logger.info(`Starting scheduler for windows: ${windows.join(', ')} in ${timezone}`);

    windows.forEach((timeStr, index) => {
        const [hour, minute] = timeStr.split(':');

        // Create cron pattern for this specific time every day
        const pattern = `${minute} ${hour} * * *`;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const job = new CronJob(
            pattern,
            async () => {
                const today = new Date().toISOString().split('T')[0];
                // Determinate job key
                const jobKey = `${today}|${index}|0`;

                logger.info(`Cron triggered for window ${timeStr}. Enqueuing PostJob ${jobKey}`);

                await postJobQueue.add(
                    'generate-post',
                    { jobKey, scheduledTime: new Date().toISOString() },
                    { jobId: jobKey } // Enforces idempotency per day/window
                );
            },
            null,
            true,
            timezone
        );
    });
}
