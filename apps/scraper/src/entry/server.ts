/**
 * HTTP server for dashboard integration
 *
 * Endpoints:
 *   POST /run      - Start scraping job
 *   GET  /progress - Get current job progress
 *   GET  /status   - Get scraper status
 *   POST /stop     - Stop current job
 */

import express from 'express';
import { CDPScraperService, getCDPScraperService } from '../scraper/cdp-processor.js';
import { isChomeAvailable } from '../scraper/cdp-browser.js';
import { ApiClient } from '../api/client.js';
import { config } from '../config.js';
import { startScheduler } from './scheduler.js';

const app = express();
app.use(express.json());

// Current job state
let currentJob: {
  id: string;
  total: number;
  completed: number;
  failed: number;
  startedAt: Date;
} | null = null;

// Last completed job
let lastJob: {
  id: string;
  success: number;
  failed: number;
  total: number;
  durationMs: number;
  completedAt: Date;
} | null = null;

const scraper = getCDPScraperService();

/**
 * Start scraping job
 */
app.post('/run', async (req, res) => {
  if (currentJob) {
    res.status(409).json({
      error: 'Job already running',
      jobId: currentJob.id,
    });
    return;
  }

  // Check if Chrome is available in debug mode
  const chromeAvailable = await isChomeAvailable();
  if (!chromeAvailable) {
    res.status(503).json({
      error: 'Chrome is not running in debug mode. Please run scripts/start-chrome-debug.bat first.',
    });
    return;
  }

  const { itemIds, mode = 'all' } = req.body;
  const jobId = `job_${Date.now()}`;

  currentJob = {
    id: jobId,
    total: 0,
    completed: 0,
    failed: 0,
    startedAt: new Date(),
  };

  console.log(`\n🚀 Starting job ${jobId} (mode: ${mode})`);

  res.json({ status: 'started', jobId });

  // Run asynchronously
  scraper.run({
    mode,
    itemIds,
    onProgress: (completed, failed, total) => {
      if (currentJob) {
        currentJob.completed = completed;
        currentJob.failed = failed;
        currentJob.total = total;
      }
    },
  })
    .then((result) => {
      console.log(`\n✅ Job ${jobId} completed: ${result.success}/${result.total}`);
      lastJob = {
        id: jobId,
        ...result,
        completedAt: new Date(),
      };
    })
    .catch((err) => {
      console.error(`\n❌ Job ${jobId} failed:`, err);
    })
    .finally(() => {
      currentJob = null;
    });
});

/**
 * Get current job progress
 */
app.get('/progress', (req, res) => {
  if (!currentJob) {
    res.json({ running: false, lastJob });
    return;
  }

  res.json({
    running: true,
    jobId: currentJob.id,
    total: currentJob.total,
    completed: currentJob.completed,
    failed: currentJob.failed,
    elapsed: Date.now() - currentJob.startedAt.getTime(),
  });
});

/**
 * Get scraper status
 */
app.get('/status', async (req, res) => {
  const apiClient = new ApiClient();
  let itemCount = 0;
  let apiStatus = 'unknown';

  try {
    const isHealthy = await apiClient.healthCheck();
    apiStatus = isHealthy ? 'healthy' : 'unhealthy';

    if (isHealthy) {
      const items = await apiClient.getItems();
      itemCount = items.length;
    }
  } catch {
    apiStatus = 'error';
  }

  res.json({
    running: !!currentJob,
    currentJob: currentJob ? {
      id: currentJob.id,
      progress: `${currentJob.completed}/${currentJob.total}`,
      elapsed: Date.now() - currentJob.startedAt.getTime(),
    } : null,
    lastJob: lastJob ? {
      id: lastJob.id,
      result: `${lastJob.success}/${lastJob.total}`,
      completedAt: lastJob.completedAt,
    } : null,
    config: {
      concurrency: config.concurrency,
      schedules: config.schedules,
      apiBaseUrl: config.apiBaseUrl,
    },
    api: {
      status: apiStatus,
      itemCount,
    },
  });
});

/**
 * Stop current job
 */
app.post('/stop', async (req, res) => {
  if (!currentJob) {
    res.json({ status: 'not_running' });
    return;
  }

  console.log(`\n🛑 Stopping job ${currentJob.id}`);

  await scraper.stop();
  currentJob = null;

  res.json({ status: 'stopped' });
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = config.serverPort;

const server = app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════');
  console.log('🚀 PriceWatch Scraper Server');
  console.log('═══════════════════════════════════════════');
  console.log(`API 서버: ${config.apiBaseUrl}`);
  console.log(`Scraper 포트: ${PORT}`);
  console.log(`동시성: ${config.concurrency}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  POST http://localhost:${PORT}/run`);
  console.log(`  GET  http://localhost:${PORT}/progress`);
  console.log(`  GET  http://localhost:${PORT}/status`);
  console.log(`  POST http://localhost:${PORT}/stop`);
  console.log('═══════════════════════════════════════════');
  console.log('');

  // Start scheduler if schedules are configured
  if (config.schedules.length > 0) {
    console.log('📅 Starting scheduler...');
    startScheduler((jobId) => {
      // Triggered by scheduler
      if (currentJob) {
        console.log(`⏭️ Skipping scheduled job ${jobId}: another job is running`);
        return;
      }

      currentJob = {
        id: jobId,
        total: 0,
        completed: 0,
        failed: 0,
        startedAt: new Date(),
      };

      scraper.run({
        mode: 'all',
        onProgress: (completed, failed, total) => {
          if (currentJob) {
            currentJob.completed = completed;
            currentJob.failed = failed;
            currentJob.total = total;
          }
        },
      })
        .then((result) => {
          console.log(`✅ Scheduled job ${jobId} completed: ${result.success}/${result.total}`);
          lastJob = {
            id: jobId,
            ...result,
            completedAt: new Date(),
          };
        })
        .catch((err) => {
          console.error(`❌ Scheduled job ${jobId} failed:`, err);
        })
        .finally(() => {
          currentJob = null;
        });
    });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  server.close();
  await scraper.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  server.close();
  await scraper.stop();
  process.exit(0);
});
