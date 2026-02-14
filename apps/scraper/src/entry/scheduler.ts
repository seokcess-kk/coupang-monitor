/**
 * Cron scheduler for automatic scraping
 */

import cron from 'node-cron';
import { config } from '../config.js';

type JobCallback = (jobId: string) => void;

/**
 * Start scheduler with configured cron jobs
 */
export function startScheduler(onTrigger: JobCallback): void {
  console.log('📅 Scheduler starting...');

  for (const schedule of config.schedules) {
    if (!cron.validate(schedule.cron)) {
      console.error(`❌ Invalid cron expression: ${schedule.cron} (${schedule.name})`);
      continue;
    }

    cron.schedule(schedule.cron, () => {
      const jobId = `scheduled_${schedule.name.replace(/\s/g, '_')}_${Date.now()}`;
      console.log(`\n⏰ Scheduled trigger: ${schedule.name} (${schedule.cron})`);
      onTrigger(jobId);
    });

    console.log(`   ✅ ${schedule.name}: ${schedule.cron}`);
  }

  console.log('');
}

/**
 * Standalone scheduler (when run directly)
 */
if (process.argv[1]?.includes('scheduler')) {
  console.log('═══════════════════════════════════════════');
  console.log('📅 PriceWatch Scheduler (Standalone)');
  console.log('═══════════════════════════════════════════');

  // Import and use ScraperService
  import('../scraper/job-processor.js').then(({ ScraperService }) => {
    const scraper = new ScraperService();

    startScheduler(async (jobId) => {
      console.log(`🚀 Starting scheduled job: ${jobId}`);

      try {
        const result = await scraper.run({ mode: 'all' });
        console.log(`✅ ${jobId} completed: ${result.success}/${result.total}`);
      } catch (error) {
        console.error(`❌ ${jobId} failed:`, error);
      }
    });

    console.log('Scheduler is running. Press Ctrl+C to stop.');
  });
}
