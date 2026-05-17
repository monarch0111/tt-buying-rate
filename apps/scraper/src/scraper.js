import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BANKS, VALID_CURRENCIES, WISE_API_KEY } from './config.js';
import { extractRatesWithLLMImage, extractRatesWithLLMText } from './llm.js';

const execFileAsync = promisify(execFile);

async function pdfToImage(pdfBuffer) {
  const tmpDir = join(tmpdir(), `forex-scraper-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  try {
    const pdfPath = join(tmpDir, 'rates.pdf');
    await writeFile(pdfPath, pdfBuffer);

    await execFileAsync('pdftoppm', ['-png', '-r', '200', '-singlefile', pdfPath, join(tmpDir, 'page')], { timeout: 10000 });

    const { default: fs } = await import('node:fs');
    const imageBuffer = await fs.promises.readFile(join(tmpDir, 'page.png'));
    return imageBuffer.toString('base64');
  } catch (err) {
    throw new Error(`PDF to image conversion failed: ${err.message}`);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function fetchPdf(url) {
  console.log(`[SCRAPER] Downloading PDF from ${url}`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
  });
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function extractForexSection(html) {
  const lower = html.toLowerCase();

  const keywords = ['forex', 'tt buy', 'tt buying', 'card rate', 'exchange rate', 'currency'];
  let bestStart = -1;
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx > 0 && (bestStart === -1 || idx < bestStart)) {
      bestStart = idx;
    }
  }

  if (bestStart > 0) {
    const start = Math.max(0, bestStart - 500);
    const end = Math.min(html.length, bestStart + 50000);
    return html.substring(start, end);
  }

  if (html.length > 50000) {
    return html.substring(0, 50000);
  }

  return html;
}

async function fetchHtml(url) {
  console.log(`[SCRAPER] Fetching HTML from ${url}`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch HTML: ${response.status}`);
  }
  let html = await response.text();
  
  // Strip scripts, styles, nav, footer to reduce token count
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  html = html.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  html = html.replace(/<header[\s\S]*?<\/header>/gi, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/\s+/g, ' ').trim();

  if (html.length < 200) {
    throw new Error(`HTML response too short (${html.length} chars), possibly blocked or redirect`);
  }

  html = extractForexSection(html);
  console.log(`[SCRAPER] HTML content size: ${html.length} chars`);

  return html;
}

async function captureHtmlScreenshot(url, bankName) {
  console.log(`[SCRAPER] Taking screenshot of ${bankName}: ${url}`);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1400, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const tableSelectors = [
      'table', '.forex-rate', '.table-responsive', '[class*="rate"]',
      '[class*="forex"]', '[class*="card-rate"]',
    ];
    for (const selector of tableSelectors) {
      const element = await page.$(selector);
      if (element) {
        await element.scrollIntoViewIfNeeded().catch(() => {});
        break;
      }
    }
    await page.waitForTimeout(1000);

    const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
    await context.close();
    return screenshot.toString('base64');
  } finally {
    await browser.close();
  }
}

async function fetchRatesFromAPI(bank) {
  if (bank.id === 'wise') {
    return fetchWiseRates(bank.targetCurrency);
  }
  throw new Error(`Unknown API bank: ${bank.id}`);
}

async function fetchWiseRates(targetCurrency) {
  const apiKey = WISE_API_KEY || process.env.WISE_API_KEY;
  if (!apiKey) {
    throw new Error('WISE_API_KEY is required for Wise API mode');
  }

  console.log(`[SCRAPER] Fetching Wise rates TO ${targetCurrency}...`);

  // Wise API: get rates FROM targetCurrency to all others, then invert
  // 1 INR = 0.012 USD  →  1 USD = 1/0.012 = 83.33 INR
  const url = `https://api.wise.com/v1/rates?source=${targetCurrency}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Wise API error (${response.status}): ${body}`);
  }

  const rates = await response.json();
  console.log(`[SCRAPER] Wise API returned ${rates.length} rate pairs`);

  const result = {};
  for (const entry of rates) {
    const currency = entry.target; // e.g. "USD" when source is "INR"
    const rateFromInr = entry.rate; // e.g. 0.012 (1 INR = 0.012 USD)

    // Invert to get "To INR" rate
    const rateToInr = 1 / rateFromInr;

    result[currency] = {
      ttBuying: parseFloat(rateToInr.toFixed(4)),
      unit: 1,
    };
  }

  console.log(`[SCRAPER] Converted to ${Object.keys(result).length} "To INR" rates`);
  return result;
}

export async function scrapeBank(bankId) {
  const bank = BANKS[bankId];
  if (!bank) {
    throw new Error(`Unknown bank: ${bankId}`);
  }

  console.log(`[SCRAPER] Starting scrape for ${bank.name} (mode: ${bank.mode})`);

  try {
    let rates;

    if (bank.mode === 'api') {
      rates = await fetchRatesFromAPI(bank);
    } else if (bank.mode === 'pdf') {
      const pdfBuffer = await fetchPdf(bank.url);
      const base64Image = await pdfToImage(pdfBuffer);
      rates = await extractRatesWithLLMImage(base64Image, bank.prompt);
    } else if (bank.mode === 'html') {
      const html = await fetchHtml(bank.url);
      if (html.length < 200) {
        throw new Error(`HTML response too short (${html.length} chars), possibly blocked or redirect`);
      }
      rates = await extractRatesWithLLMText(html, bank.prompt);
    } else if (bank.mode === 'llm') {
      const base64Image = await captureHtmlScreenshot(bank.url, bank.name);
      rates = await extractRatesWithLLMImage(base64Image, bank.prompt);
    } else {
      throw new Error(`Unknown mode: ${bank.mode}`);
    }

    return filterValidRates(rates);
  } catch (err) {
    console.error(`[SCRAPER] Error scraping ${bank.name}:`, err.message);
    return null;
  }
}

function filterValidRates(rates) {
  const validRates = {};
  for (const [currency, data] of Object.entries(rates)) {
    if (!VALID_CURRENCIES.includes(currency) || data.ttBuying <= 0) continue;

    let unit = data.unit || (currency === 'JPY' || currency === 'THB' ? 100 : 1);

    // Post-processing: detect and fix unit errors from LLM
    // JPY is always per 100; if LLM returned unit=1 but value > 5, it's per-100
    if (currency === 'JPY' && unit === 1 && data.ttBuying > 5) {
      console.log(`  [FIX] ${currency}: unit=1 → 100 (ttBuying=${data.ttBuying} looks per-100)`);
      unit = 100;
    }
    // THB: if LLM returned unit=1 but value > 50, it's actually per-100
    if (currency === 'THB' && unit === 1 && data.ttBuying > 50) {
      console.log(`  [FIX] ${currency}: unit=1 → 100 (ttBuying=${data.ttBuying} looks per-100)`);
      unit = 100;
    }

    validRates[currency] = {
      ttBuying: data.ttBuying,
      unit,
    };
  }

  if (Object.keys(validRates).length === 0) {
    console.log(`[SCRAPER] No valid rates found`);
    return null;
  }

  console.log(`[SCRAPER] Found ${Object.keys(validRates).length} currencies`);
  for (const [currency, rate] of Object.entries(validRates)) {
    console.log(`  ${currency}: TT Buy = ${rate.ttBuying} (per ${rate.unit})`);
  }

  return validRates;
}