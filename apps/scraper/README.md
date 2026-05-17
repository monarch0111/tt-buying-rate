# @forex/scraper

Local Playwright + LLM scraper that runs on a Raspberry Pi (or any machine). It screenshots bank pages or downloads PDFs, then uses OpenRouter LLM to extract TT Buying rates.

## Setup

```bash
npm install
npx playwright install chromium
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | Get yours at https://openrouter.ai/keys |
| `OPENROUTER_MODEL` | No | Default: `google/gemini-2.0-flash-001` |
| `WISE_API_KEY` | Yes (for Wise) | Wise API key |
| `R2_ENDPOINT` | Yes | Cloudflare R2 S3 endpoint |
| `R2_ACCESS_KEY_ID` | Yes | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 secret key |
| `R2_BUCKET` | No | Default: `forex-rates` |

## Usage

### Scrape all banks and upload
```bash
OPENROUTER_API_KEY=sk-... WISE_API_KEY=... R2_ENDPOINT=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... npm run scrape
```

### Scrape a single bank
```bash
OPENROUTER_API_KEY=sk-... node src/index.js --bank hdfc
```

### Available bank scripts
- `npm run scrape:hdfc`
- `npm run scrape:axis`
- `npm run scrape:icici`
- `npm run scrape:kotak`
- `npm run scrape:pnb`
- `npm run scrape:sbi`

### Dry run (scrape but don't upload)
```bash
OPENROUTER_API_KEY=sk-... npm run test
```

## How It Works

1. For HTML banks: Fetches HTML, strips tags, sends text to LLM
2. For PDF banks: Downloads PDF, converts to PNG via `pdftoppm`, sends image to LLM vision
3. For JS-rendered banks (Kotak): Playwright screenshot, sends image to LLM vision
4. For Wise: Direct API call (no LLM)
5. Writes results directly to R2 via S3-compatible API
6. Builds read-optimized files: `latest.json`, `banks/{id}.json`, `history/{bank}/{currency}.json`

## Models

Recommended OpenRouter models (must support vision):
- `google/gemini-2.0-flash-001` (default) - cheap, fast, accurate (~$0.0005/image)
- `google/gemini-2.5-flash-preview` - better accuracy
- `openai/gpt-4o-mini` - good vision support
- Note: `openai/gpt-5-nano` is a reasoning model that does NOT produce JSON output

## Cron Setup (Raspberry Pi)

```bash
crontab -e
```

Add:
```
0 */4 * * * cd /home/user/tt-buying-rate/apps/scraper && OPENROUTER_API_KEY=sk-... WISE_API_KEY=... R2_ENDPOINT=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... node src/index.js >> /var/log/forex-scraper.log 2>&1
```

This runs every 4 hours. Cost estimate: ~$0.01/day (7 banks x 6 runs = 42 LLM calls/day).