import { scrapeBank } from './scraper.js';
import { saveSnapshot, buildAllReadOptimizedFiles } from './r2.js';
import { BANKS, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT } from './config.js';

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_BANK = process.argv.find((arg, i) => process.argv[i - 1] === '--bank');

async function main() {
  if (SINGLE_BANK && !BANKS[SINGLE_BANK]) {
    console.error(`[SCRAPER] Error: unknown bank "${SINGLE_BANK}"`);
    console.error(`[SCRAPER] Valid banks: ${Object.keys(BANKS).join(', ')}`);
    process.exit(1);
  }

  const usesLLM = SINGLE_BANK
    ? BANKS[SINGLE_BANK]?.mode !== 'api'
    : Object.values(BANKS).some(b => b.mode !== 'api');

  if (usesLLM && !process.env.OPENROUTER_API_KEY) {
    console.error('[SCRAPER] Error: OPENROUTER_API_KEY required for LLM mode');
    console.error('[SCRAPER] Get your key at https://openrouter.ai/keys');
    process.exit(1);
  }

  if (!DRY_RUN && (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY)) {
    console.error('[SCRAPER] Error: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY required');
    console.error('[SCRAPER] Create credentials at: Cloudflare Dashboard → R2 → Manage Tokens');
    process.exit(1);
  }

  console.log(`[SCRAPER] Starting scrape... ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`[SCRAPER] LLM Model: ${process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'}`);
  if (!DRY_RUN) {
    console.log(`[SCRAPER] R2 Endpoint: ${R2_ENDPOINT}`);
  }

  const banksToScrape = SINGLE_BANK
    ? [SINGLE_BANK]
    : Object.keys(BANKS);

  const results = [];

  for (const bankId of banksToScrape) {
    const bank = BANKS[bankId];
    console.log(`\n[SCRAPER] Scraping ${bank.name}...`);

    try {
      const rates = await scrapeBank(bankId);

      if (!rates || Object.keys(rates).length === 0) {
        console.log(`[SCRAPER] No rates found for ${bank.name}`);
        results.push({ bank: bankId, success: false, error: 'No rates found' });
        continue;
      }

      const scrapedAt = new Date().toISOString();

      if (DRY_RUN) {
        console.log(`[SCRAPER] [DRY RUN] Would save ${Object.keys(rates).length} rates for ${bank.name}`);
        results.push({ bank: bankId, success: true, ratesCount: Object.keys(rates).length });
        continue;
      }

      // Save snapshot + rebuild all read-optimized files
      await saveSnapshot(bankId, rates, scrapedAt);
      await buildAllReadOptimizedFiles(bankId);

      console.log(`[SCRAPER] Saved ${bank.name}: ${Object.keys(rates).length} currencies`);
      results.push({ bank: bankId, success: true, ratesCount: Object.keys(rates).length });

    } catch (err) {
      console.error(`[SCRAPER] Error: ${err.message}`);
      results.push({ bank: bankId, success: false, error: err.message });
    }

    if (banksToScrape.indexOf(bankId) < banksToScrape.length - 1) {
      console.log('[SCRAPER] Waiting 5s before next bank...');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  console.log('\n[SCRAPER] ========== Summary ==========');
  const successful = results.filter(r => r.success).length;
  console.log(`[SCRAPER] Successful: ${successful}/${results.length}`);
  for (const r of results) {
    const status = r.success ? `✓ ${r.bank} (${r.ratesCount} rates)` : `✗ ${r.bank}: ${r.error}`;
    console.log(`  ${status}`);
  }
  console.log('[SCRAPER] ================================');

  process.exit(results.every(r => r.success) ? 0 : 1);
}

main().catch(err => {
  console.error('[SCRAPER] Fatal:', err);
  process.exit(1);
});
