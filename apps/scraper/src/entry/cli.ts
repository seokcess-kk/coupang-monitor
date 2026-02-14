#!/usr/bin/env node
/**
 * CLI entry point for manual scraping
 *
 * Usage:
 *   pnpm scraper:run              # Run all items (CDP mode - default)
 *   pnpm scraper:run --all        # Run all items (explicit)
 *   pnpm scraper:run -i 1,2,3     # Run specific items
 *   pnpm scraper:run --puppeteer  # Use standalone Puppeteer (will be blocked)
 */

import { Command } from 'commander';
import { ScraperService } from '../scraper/job-processor.js';
import { CDPScraperService } from '../scraper/cdp-processor.js';
import { ApiClient } from '../api/client.js';
import { config } from '../config.js';

const program = new Command();

program
  .name('pricewatch-scraper')
  .description('쿠팡 가격 수집 CLI')
  .version('1.0.0');

program
  .command('run')
  .description('가격 수집 실행')
  .option('-a, --all', '전체 상품 수집', false)
  .option('-i, --items <ids>', '특정 상품 ID (쉼표 구분)')
  .option('-c, --concurrency <n>', '동시 브라우저 수', String(config.concurrency))
  .option('--puppeteer', 'Puppeteer 모드 사용 (CDP 대신)', false)
  .action(async (options) => {
    const useCDP = !options.puppeteer;

    console.log('═══════════════════════════════════════════');
    console.log('🚀 PriceWatch Scraper');
    console.log('═══════════════════════════════════════════');
    console.log(`모드: ${useCDP ? 'CDP (Chrome 연결)' : 'Puppeteer (독립 실행)'}`);
    console.log(`동시성: ${options.concurrency}`);
    console.log(`API: ${config.apiBaseUrl}`);

    if (useCDP) {
      console.log('');
      console.log('💡 Chrome Debug 모드가 필요합니다.');
      console.log('   실행: scripts/start-chrome-debug.bat');
    }
    console.log('');

    try {
      const itemIds = options.items?.split(',').map((s: string) => s.trim());

      let result;

      if (useCDP) {
        // CDP 모드 (기본)
        const scraper = new CDPScraperService();
        result = await scraper.run({
          mode: options.all || !itemIds ? 'all' : 'selected',
          itemIds,
          onProgress: () => {},
        });
      } else {
        // Puppeteer 모드 (차단될 수 있음)
        const scraper = new ScraperService();
        result = await scraper.run({
          mode: options.all || !itemIds ? 'all' : 'selected',
          itemIds,
          onProgress: () => {},
        });
      }

      console.log('');
      console.log('═══════════════════════════════════════════');
      console.log('✅ 수집 완료!');
      console.log(`   성공: ${result.success}개`);
      console.log(`   실패: ${result.failed}개`);
      console.log(`   소요시간: ${Math.round(result.durationMs / 1000)}초`);
      console.log('═══════════════════════════════════════════');

      process.exit(result.failed > 0 ? 1 : 0);
    } catch (error) {
      console.error('');
      console.error('❌ 수집 실패:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('상품 목록 및 상태 확인')
  .action(async () => {
    const apiClient = new ApiClient();

    try {
      const items = await apiClient.getItems();

      console.log('');
      console.log(`📋 등록된 상품: ${items.length}개`);
      console.log('');

      if (items.length === 0) {
        console.log('등록된 상품이 없습니다.');
        return;
      }

      console.log('ID\t\t\t\t이름');
      console.log('─'.repeat(60));

      for (const item of items.slice(0, 20)) {
        const name = item.name?.substring(0, 40) || '(이름 없음)';
        console.log(`${item.id.substring(0, 8)}...\t${name}`);
      }

      if (items.length > 20) {
        console.log(`... 그 외 ${items.length - 20}개`);
      }
    } catch (error) {
      console.error('❌ 상태 확인 실패:', error);
      process.exit(1);
    }
  });

program
  .command('health')
  .description('API 서버 상태 확인')
  .action(async () => {
    const apiClient = new ApiClient();

    console.log(`API 서버: ${config.apiBaseUrl}`);

    const isHealthy = await apiClient.healthCheck();

    if (isHealthy) {
      console.log('✅ API 서버 정상');
    } else {
      console.log('❌ API 서버 연결 실패');
      process.exit(1);
    }
  });

program.parse();
