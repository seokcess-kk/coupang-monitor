/**
 * PM2 ecosystem configuration
 * Run with: pm2 start ecosystem.config.cjs
 */

module.exports = {
  apps: [
    {
      name: 'pricewatch-scraper',
      script: './dist/entry/server.js',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',

      // Environment variables
      env: {
        NODE_ENV: 'production',
        API_BASE_URL: 'http://localhost:3000',
        SCRAPER_PORT: 3001,
        SCRAPER_CONCURRENCY: 3,
        SCRAPER_HEADLESS: 'true',
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      merge_logs: true,

      // Restart policy
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};
