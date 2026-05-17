# TT Buying Rate Tracker

Track TT Buying forex card rates from major Indian banks with historical trends and a remittance calculator.

## Architecture

```
┌─────────────┐   S3 PutObject (direct)   ┌─────────────┐   GET public URL   ┌─────────────┐
│  Scraper     │ ───────────────────────── │  Cloudflare  │ ◄───────────────── │ Astro Web   │
│  (Raspberry  │   authenticated R2 write  │  R2 Bucket   │                   │ Frontend    │
│   Pi / cron) │                           │  (public)    │                   │ (Pages)     │
└─────────────┘                           └─────────────┘                   └─────────────┘
```

**Scraper** runs on a Raspberry Pi every 4h, fetches bank PDFs/HTML, uses OpenRouter LLM to extract TT Buying rates, and writes directly to Cloudflare R2. **Frontend** reads directly from R2 — no server-side proxy.

## Banks Supported

| Bank | Mode | Notes |
|------|------|-------|
| HDFC Bank | PDF → LLM vision | `pdftoppm` conversion |
| Axis Bank | HTML → LLM text | Stripped HTML extraction |
| ICICI Bank | HTML → LLM text | Stripped HTML extraction |
| Kotak Mahindra | Screenshot → LLM vision | JS-rendered, needs Playwright |
| PNB | PDF → LLM vision | `pdftoppm` conversion |
| SBI | PDF → LLM vision | `pdftoppm` conversion |
| Wise | REST API | Direct API call, no LLM |

## Tech Stack

- **Frontend**: Astro (static) + Alpine.js, deployed on Cloudflare Pages
- **Scraper**: Node.js + Playwright + OpenRouter LLM + AWS S3 SDK, runs on Raspberry Pi
- **Storage**: Cloudflare R2 (public read, S3-compatible write)

## Project Structure

```
indian-forex-tracker/
├── apps/
│   ├── scraper/        # Playwright + LLM scraper (runs on RPi)
│   └── web/            # Astro frontend (Cloudflare Pages)
├── packages/
│   └── shared/         # TypeScript types, bank/currency configs
├── package.json
└── pnpm-workspace.yaml
```

## Getting Started

### Prerequisites

- Node.js >= 20, pnpm >= 8
- `pdftoppm` (for PDF banks, on Raspberry Pi)

### Install

```bash
pnpm install
```

### Build

```bash
pnpm build
```

### Local Development

```bash
pnpm dev:web    # Astro dev server at http://localhost:4321
```

### Scraper

Copy `.env.example` to `apps/scraper/.env` and fill in your keys, then:

```bash
cd apps/scraper
node src/index.js              # Scrape all banks
node src/index.js --bank hdfc   # Scrape single bank
node src/index.js --dry-run     # Test without uploading
```

### Deploy Frontend

```bash
pnpm build
cd apps/web && npx wrangler pages deploy dist --project-name <YOUR_PROJECT>
```

## Costs

| Component | Monthly Cost |
|-----------|-------------|
| Cloudflare Pages | Free |
| Cloudflare R2 | Free (<10GB) |
| OpenRouter LLM | ~$1.50/mo |
| **Total** | **~$1.50** |

## License

MIT