// This file will be imported by instrumentation.ts and should be compiled by Next.js
import { CronScheduler } from './cron/scheduler';

export function initializeCronJobs() {
    try {
        console.log('📅 Initializing cron scheduler (from compiled code)...');
        CronScheduler.startAll();
        console.log('✅ Cron scheduler initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize cron scheduler:', error);
    }
}
