// Pure JavaScript cron initialization (no TypeScript dependencies)
const cron = require('node-cron');

// IMPORTANT: Run locally inside the container
const BASE_URL = 'http://127.0.0.1:3000';

// Simple function to call cron API
async function callCronAPI(jobId) {
    try {
        console.log(`🔄 Running job via API: ${jobId} -> ${BASE_URL}/api/cron/run`);

        // Use native fetch (Node 18+)
        const response = await fetch(`${BASE_URL}/api/cron/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': 'system-cron',
                'X-User-Email': 'system@localhost',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ jobId }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error: ${response.status} - ${error}`);
        }

        const result = await response.json();
        console.log(`✅ Job completed: ${jobId}`);
        return result;
    } catch (error) {
        console.error(`❌ Job failed: ${jobId}`, error.message);
        // Retry logic? No, cron will retry next time.
    }
}

// Initialize all cron jobs
function initializeCronJobs() {
    console.log('📅 Initializing cron jobs (JavaScript version)...');

    const jobs = [
        { id: 'sync-stock', name: 'Stok Senkronizasyonu', schedule: '*/2 * * * *' },
        { id: 'sync-price', name: 'Fiyat Senkronizasyonu', schedule: '*/2 * * * *' },
        { id: 'sync-location', name: 'Lokasyon Senkronizasyonu', schedule: '*/2 * * * *' },
        { id: 'process-orders', name: 'Sipariş İşleme', schedule: '*/2 * * * *' },
        { id: 'process-cancelled-orders', name: 'İptal İşleme', schedule: '*/2 * * * *' },
        { id: 'sync-order-status', name: 'Sipariş Durumu Güncelleme', schedule: '*/2 * * * *' },
    ];

    let scheduledCount = 0;

    jobs.forEach((job) => {
        try {
            cron.schedule(job.schedule, async () => {
                console.log(`🔄 Running: ${job.name}`);
                await callCronAPI(job.id);
            });
            scheduledCount++;
            console.log(`📅 Scheduled: ${job.name} (${job.schedule})`);
        } catch (error) {
            console.error(`❌ Failed to schedule ${job.name}:`, error.message);
        }
    });

    console.log(`✅ ${scheduledCount} cron jobs initialized`);
}

// Start cron jobs
// function initializeCronJobs() { ... }

// Export proper function for use in custom-server.js
module.exports = { initializeCronJobs };

// Only auto-run if directly executed (not required)
if (require.main === module) {
    initializeCronJobs();
}

// Keep process alive
console.log('🚀 Worker started and waiting for cron jobs...');
console.log(`🔗 Target URL: ${BASE_URL}`);

setInterval(() => {
    // Keep alive every hour
    console.log('💓 Worker heartbeat');
}, 1000 * 60 * 60);
