# TT Buying Rate Tracker — AGENTS.md

## Architecture Overview

```
┌─────────────┐   S3 PutObject (direct)   ┌─────────────┐   GET public URL   ┌─────────────┐
│  Scraper     │ ───────────────────────── │  Cloudflare  │ ◄───────────────── │ Astro Web   │
│  (Raspberry  │   authenticated R2 write  │  R2 Bucket   │                   │ Frontend    │
│   Pi / cron) │                           │  (public)    │                   │ (Pages)     │
└─────────────┘                           └─────────────┘                   └─────────────┘
      │                                          │
      │ Playwright + LLM                         │ Keys:
      │ (OpenRouter Gemini 2.0 Flash)           │   latest.json
      ▼                                         │   banks/{bank}.json
  Bank websites                                 │   history/{bank}/{ts}.json
  (PDF, HTML, JS-rendered)                     │   history/{bank}/latest.json
                                                │   history/{bank}/{currency}.json
                                                └
```

### Components

| Component | Directory | Tech | Deploy Target |
|-----------|-----------|------|---------------|
| Web Frontend | `apps/web/` | Astro (static) + Alpine.js | Cloudflare Pages |
| Scraper | `apps/scraper/` | Node.js + Playwright + OpenRouter LLM + AWS S3 SDK | Raspberry Pi (local, cron) |
| Shared Config | `packages/shared/` | TypeScript types + bank/currency configs | N/A (library) |

### Data Flow

1. **Scraper** (runs every 4h on RPi via cron) fetches bank PDFs/HTML, converts to images or extracts text, sends to OpenRouter LLM to extract TT Buying rates as JSON
2. **Scraper writes directly to R2** using AWS S3 SDK (`@aws-sdk/client-s3`) with S3-compatible credentials
3. Scraper saves:
   - Dated snapshots: `history/{bank}/{timestamp}.json`
   - Per-bank latest: `history/{bank}/latest.json`
   - Aggregated: `latest.json`
   - Per-bank read-optimized: `banks/{bank}.json`
   - Per-currency history: `history/{bank}/{currency}.json`
4. **Web Frontend** fetches directly from R2 public URL — no server-side proxy involved
5. Alpine.js hydrates the static HTML with filtering, sorting, chart rendering (uPlot + SVG), theme toggle, multi-currency selection, and remittance calculator

### Bank Scraping Modes

| Bank | ID | Mode | URL |
|------|-----|------|-----|
| HDFC Bank | `hdfc` | `pdf` | PDF download → `pdftoppm` → PNG → LLM vision |
| Axis Bank | `axis` | `html` | HTML fetch → strip tags → LLM text extraction |
| ICICI Bank | `icici` | `html` | HTML fetch → strip tags → LLM text extraction |
| Kotak Mahindra | `kotak` | `llm` | Playwright screenshot → LLM vision (JS-rendered page) |
| PNB | `pnb` | `pdf` | PDF download → `pdftoppm` → PNG → LLM vision |
| SBI | `sbi` | `pdf` | PDF download → `pdftoppm` → PNG → LLM vision |
| Wise | `wise` | `api` | Direct API call to `api.wise.com/v1/rates` (no LLM) |

---

## R2 File Structure

```
forex-rates (R2 bucket, public read)
├── latest.json                          # Aggregated latest rates for all banks
├── banks/
│   ├── hdfc.json                        # Per-bank latest rates (read-optimized)
│   ├── axis.json
│   ├── icici.json
│   ├── kotak.json
│   ├── pnb.json
│   ├── sbi.json
│   └── wise.json
└── history/
    ├── hdfc/
    │   ├── latest.json                  # Latest snapshot for this bank
    │   ├── 2025-01-15T10-30-00-000Z.json # Dated snapshot
    │   ├── USD.json                     # Per-currency history (read-optimized)
    │   ├── EUR.json
    │   └── ...
    ├── axis/
    └── ... (same pattern for all 7 banks)
```

**Important**: The scraper's `buildAllReadOptimizedFiles()` rebuilds `latest.json`, `banks/{id}.json`, and all `history/{bank}/{currency}.json` files after every upload. This means the frontend never lists R2 objects or filters history server-side — everything is pre-computed.

---

## Deployment

### Prerequisites

- Node.js >= 20
- pnpm >= 8
- Wrangler CLI (installed as devDependency)
- Cloudflare account with Pages + R2 access
- OpenRouter API key (for scraper LLM calls)
- AWS S3-compatible R2 credentials (for scraper)
- `pdftoppm` installed on the Raspberry Pi (for PDF banks)

### Build from Root

```bash
# Builds shared package, then web
pnpm build
```

### Deploy the Web Frontend (Cloudflare Pages)

```bash
cd apps/web
pnpm build
npx wrangler pages deploy dist --project-name <YOUR_PAGES_PROJECT>
```

### Deploy / Run the Scraper (Raspberry Pi)

```bash
# Sync from local to RPi
rsync -avz --exclude='node_modules' --exclude='.git' ~/tt-buying-rate/ <YOUR_USER>@<YOUR_RPI_HOST>:~/tt-buying-rate/

# Install deps on RPi (first time or after dependency changes)
ssh <YOUR_USER>@<YOUR_RPI_HOST> 'cd ~/tt-buying-rate/apps/scraper && npm install'

# Run a single bank scrape
ssh <YOUR_USER>@<YOUR_RPI_HOST> 'cd ~/tt-buying-rate/apps/scraper && OPENROUTER_API_KEY=<YOUR_KEY> WISE_API_KEY=<YOUR_KEY> R2_ENDPOINT=<YOUR_ENDPOINT> R2_ACCESS_KEY_ID=<YOUR_KEY> R2_SECRET_ACCESS_KEY=<YOUR_KEY> node src/index.js --bank hdfc'

# Run all banks
ssh <YOUR_USER>@<YOUR_RPI_HOST> 'cd ~/tt-buying-rate/apps/scraper && OPENROUTER_API_KEY=<YOUR_KEY> WISE_API_KEY=<YOUR_KEY> R2_ENDPOINT=<YOUR_ENDPOINT> R2_ACCESS_KEY_ID=<YOUR_KEY> R2_SECRET_ACCESS_KEY=<YOUR_KEY> node src/index.js'
```

RPi cron (every 4 hours):
```
0 */4 * * * cd /home/<USER>/tt-buying-rate/apps/scraper && OPENROUTER_API_KEY=<YOUR_KEY> WISE_API_KEY=<YOUR_KEY> R2_ENDPOINT=<YOUR_ENDPOINT> R2_ACCESS_KEY_ID=<YOUR_KEY> R2_SECRET_ACCESS_KEY=<YOUR_KEY> node src/index.js >> /home/<USER>/scraper.log 2>&1
```

### Deploy Everything

```bash
# From project root
pnpm build
cd apps/web && npx wrangler pages deploy dist --project-name <YOUR_PAGES_PROJECT>
# Then rsync to RPi for scraper updates
```

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/banks.ts` | Bank configs: IDs, names, URLs, scraping modes, LLM prompts |
| `packages/shared/src/types.ts` | TypeScript interfaces (`RateSnapshot`, `RateEntry`, `BankConfig`, etc.) |
| `packages/shared/src/currencies.ts` | 17 tracked currencies with names, symbols, default units |
| `apps/scraper/src/config.js` | Bank URLs, modes, prompts, env vars, R2 credentials |
| `apps/scraper/src/scraper.js` | Main scraper: PDF→pdftoppm→image, HTML→text, Playwright screenshot, Wise API |
| `apps/scraper/src/llm.js` | OpenRouter API calls for image and text extraction |
| `apps/scraper/src/r2.js` | **Direct R2 writes** using AWS S3 SDK; builds `latest.json`, per-bank, per-currency files |
| `apps/scraper/src/index.js` | CLI entry: runs banks sequentially with 5s delay |
| `apps/web/src/layouts/Layout.astro` | Theme system (dark/light), IBM Plex fonts, CSS variables, header, footer |
| `apps/web/src/pages/index.astro` | Dashboard: KPI cards, rate comparison table, filters, bank cards |
| `apps/web/src/pages/bank/[slug].astro` | Bank detail: multi-currency uPlot line chart, current rates table, currency pills |
| `apps/web/src/pages/currency/[code].astro` | Currency detail: bank comparison table, SVG trend chart, spread analysis |
| `apps/web/src/pages/calculator.astro` | Remittance calculator: net INR payout after fees, best provider highlight |
| `apps/web/src/config.ts` | R2 public URL constant (`R2_PUBLIC_URL`) |

---

## Cloudflare Resources

| Resource | Description |
|----------|-------------|
| Pages Project | Deployed via `wrangler pages deploy` |
| R2 Bucket | `forex-rates` — public read, S3-compatible write from scraper |
| Custom Domain | Configured in Cloudflare Pages settings |

---

## Environment Variables

### Scraper (set as env vars or in a shell script on the RPi)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes (for LLM banks) | OpenRouter API key |
| `OPENROUTER_MODEL` | No | Default: `google/gemini-2.0-flash-001` |
| `R2_ENDPOINT` | Yes | Cloudflare R2 S3 endpoint URL |
| `R2_ACCESS_KEY_ID` | Yes | R2 access key (from Cloudflare R2 → Manage Tokens) |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 secret key (from Cloudflare R2 → Manage Tokens) |
| `R2_BUCKET` | No | Default: `forex-rates` |
| `WISE_API_KEY` | Yes (for Wise bank) | Wise API key |

### Web Frontend
- No env vars needed at build time. R2 public URL is hardcoded in `apps/web/src/config.ts`.

---

## Frontend Pages & Features

### Dashboard (`/`)
- KPI cards: bank count, currency count, best USD rate, live/stale status
- Rate comparison table: currencies as rows, banks as columns
- Row click navigates to `/currency/{code}`
- Filters: currency dropdown, sort by currency/best rate, highlight best toggle
- Bank cards at bottom link to `/bank/{slug}`
- Auto-refreshes every 5 minutes

### Bank Detail (`/bank/{slug}`)
- Hero section with bank name, live/stale badge, last updated
- KPI cards: currency count, best rate, lowest rate, spread
- **Multi-currency uPlot chart**:
  - Currency pill buttons to toggle lines (max 6)
  - Days toggle: 7D / 14D / 30D
  - Fetches `history/{bank}/{currency}.json` for each selected currency
- Rates table: all currencies for this bank, with effective rate
- Row click toggles currency on the chart

### Currency Detail (`/currency/{code}`)
- Hero with currency code + name
- KPI cards: best rate, worst rate, spread
- Bank comparison table sorted by best rate
- **SVG trend chart**: compares all banks' historical rates for this currency
- Days toggle: 7D / 14D / 30D

### Remittance Calculator (`/calculator`)
- Input: amount + source currency
- Calculates net INR payout after fees for all providers
- Fee model:
  - Banks: flat ₹200–₹250 + 18% GST
  - Wise: ~0.6% of gross amount
- Highlights best provider with green banner and "Best" badge
- Disclaimer about approximate fees and additional SWIFT charges

---

## Design Decisions

1. **Scraping architecture**: Runs on Raspberry Pi because Workers can't run Playwright/pdftoppm, and CPU limits are too tight for LLM calls. Scraper writes directly to R2 via S3 API.
2. **LLM provider**: OpenRouter with Gemini 2.0 Flash (cheap at ~$0.001/bank). `openai/gpt-5-nano` does NOT work — it's a reasoning model that returns `content: null`.
3. **HTML banks**: Send stripped HTML text to LLM (cheaper, ~$0.001/bank) with smart extraction of forex section via keyword matching.
4. **PDF banks**: Convert via `pdftoppm` to PNG, send image to LLM vision.
5. **JS-rendered banks (Kotak)**: Use Playwright screenshot mode since static HTML fetch returns empty content.
6. **Wise API**: Direct REST API call — no LLM needed. Inverts rates (from `1 INR = X USD` to `1 USD = X INR`).
7. **Frontend reads R2 directly**: No server-side proxy. Static file serving from R2's CDN.
8. **Read-optimized files**: Pre-built `banks/{id}.json` and `history/{bank}/{currency}.json` so frontend never lists objects or filters history server-side.
9. **Frontend**: Plain Alpine.js (no build step for JS), Astro for static HTML generation.
   - SVG charts on currency page rendered with `x-html` (Alpine `<template>` directives don't work inside `<svg>`)
   - Bank detail page uses uPlot for interactive multi-currency line charts
10. **Theme**: Dark mode is default. IBM Plex Sans + IBM Plex Mono fonts.
11. **Scraper cost**: ~$0.007/run (6 banks + Wise), ~$0.05/day at 6 runs/day.

---

## Known Issues & Caveats

- `openai/gpt-5-nano` returns `content: null` — do not use
- Alpine.js `<template x-for>` / `<template x-if>` do not work inside `<svg>` elements — use `x-html` with string-built SVG instead
- Astro template literals (`${var}`) in HTML attributes get HTML-escaped — use `data-*` attributes + `this.$el.dataset` instead
- Kotak uses `.com` domain (`kotak.com`), not `.bank.in`
- `pdftoppm` must be installed on the RPi for PDF bank scraping
- The scraper's `buildAllReadOptimizedFiles()` lists ALL historical snapshots for a bank on every run. As history grows, this will get slower. Consider adding pagination or a compaction strategy.
- R2 S3 credentials on the RPi have full read/write access to the bucket. If leaked, an attacker can delete or corrupt all data.

---

## Monorepo Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev:web` | Start Astro dev server at `http://localhost:4321` |
| `pnpm build` | Build shared → web |
| `pnpm deploy:web` | Deploy web frontend to Cloudflare Pages |
| `pnpm lint` | Run lint across all packages |
| `pnpm typecheck` | Run TypeScript checks across all packages |

### Package-specific Scripts

**Web (`apps/web`):**
- `pnpm dev` — `astro dev`
- `pnpm build` — `astro build`
- `pnpm deploy` — `wrangler pages deploy dist`

**Scraper (`apps/scraper`):**
- `pnpm scrape` — Run all banks
- `pnpm scrape:hdfc` — Run single bank
- `pnpm test` — Dry run (no R2 writes)

---

## Adding a New Bank

1. **Add bank config** to both:
   - `packages/shared/src/banks.ts` — TypeScript config
   - `apps/scraper/src/config.js` — Scraper config

   Required fields: `id`, `name`, `url`, `mode` (`pdf` | `html` | `llm` | `api`), `prompt` (for LLM modes)

2. **Add bank to frontend** in:
   - `apps/web/src/pages/index.astro` — `bankNames` object in Alpine.js `dashboard()`
   - `apps/web/src/pages/bank/[slug].astro` — `getStaticPaths()` and `bankNames` object
   - `apps/web/src/pages/currency/[code].astro` — `bankNames` object if needed
   - `apps/web/src/pages/calculator.astro` — `bankNames` and `BANK_FEES` objects

3. **Add fee data** (if applicable) in `apps/web/src/pages/calculator.astro` `BANK_FEES` object.

4. **Test scraper locally**:
   ```bash
   cd apps/scraper
   OPENROUTER_API_KEY=<YOUR_KEY> WISE_API_KEY=<YOUR_KEY> R2_ENDPOINT=<YOUR_ENDPOINT> R2_ACCESS_KEY_ID=<YOUR_KEY> R2_SECRET_ACCESS_KEY=<YOUR_KEY> node src/index.js --bank <new-bank-id> --dry-run
   ```

5. **Deploy**: Build and deploy web. Sync scraper to RPi.

---

## Adding a New Currency

1. **Add to shared config**:
   - `packages/shared/src/currencies.ts` — Add to `CURRENCIES` array
   - `apps/scraper/src/config.js` — Add to `VALID_CURRENCIES` array

2. **Update frontend**:
   - `apps/web/src/pages/index.astro` — `symbols` and `names` objects
   - `apps/web/src/pages/bank/[slug].astro` — `CURRENCY_NAMES` object
   - `apps/web/src/pages/currency/[code].astro` — `getStaticPaths()` and `currencyNames` object
   - `apps/web/src/pages/calculator.astro` — `names` object

3. **Update LLM prompts** in bank configs to remind the model about the new currency and its unit (1 or 100).

4. **Redeploy** web. No scraper changes needed if the new currency is already present on bank pages.