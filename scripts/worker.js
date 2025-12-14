// =============================================================================
// Background Worker Process
// Stock Management System - E-Commerce Admin Panel
// Handles background jobs, cron tasks, and notifications
// =============================================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

console.log('🔄 Worker starting...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📥 SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📥 SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Worker main loop
async function startWorker() {
  console.log('✅ Worker started successfully');
  console.log('⏰ Waiting for background jobs...');

  // Keep the process alive
  setInterval(() => {
    console.log('💓 Worker heartbeat:', new Date().toISOString());
  }, 60000); // Every minute
}

// Start worker
startWorker().catch((error) => {
  console.error('❌ Worker error:', error);
  process.exit(1);
});
