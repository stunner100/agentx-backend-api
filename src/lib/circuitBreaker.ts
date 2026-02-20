import { pino } from 'pino';
import 'dotenv/config';

const logger = pino({ name: 'CircuitBreaker' });

interface CircuitState {
    failureCount: number;
    lastFailureTime: number;
    isOpen: boolean; // if true, posting is paused
}

const state: CircuitState = {
    failureCount: 0,
    lastFailureTime: 0,
    isOpen: false,
};

const THRESHOLD = 5;
const RESET_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function recordFailure() {
    const now = Date.now();

    // If we are recovering from a previous state after timeout, reset count
    if (now - state.lastFailureTime > RESET_TIMEOUT_MS) {
        state.failureCount = 0;
    }

    state.failureCount += 1;
    state.lastFailureTime = now;

    logger.warn(`Circuit breaker failure recorded. Count: ${state.failureCount}`);

    if (state.failureCount >= THRESHOLD && !state.isOpen) {
        state.isOpen = true;
        logger.error(`Circuit breaker TRIPPED! Posting is paused for ${RESET_TIMEOUT_MS / 60000} minutes.`);
        // Optionally trigger an alert (email/webhook) here
    }
}

export function recordSuccess() {
    if (state.isOpen) {
        logger.info('Circuit breaker completely reset upon success.');
        state.isOpen = false;
    }
    state.failureCount = 0;
}

export function isCircuitOpen(): boolean {
    // Check if we are globally killed
    if (process.env.GLOBAL_KILL_SWITCH === 'true') {
        return true;
    }

    // Check if breaker is tripped
    if (state.isOpen) {
        const now = Date.now();
        // Allow half-open state if timeout has passed
        if (now - state.lastFailureTime > RESET_TIMEOUT_MS) {
            logger.info('Circuit breaker entering half-open state (allowing trial request).');
            return false; // Let the next request try
        }
        return true;
    }

    return false;
}
