# Lost Cities Scorer 🗺️

A mobile-optimized Progressive Web App that scores the **Lost Cities** card game instantly — snap a photo of the board or enter cards manually.

## Features

- 📷 **Photo Scanning** — Take a photo of your board, AI extracts all cards automatically
- ✏️ **Manual Entry** — Tap to enter cards for each expedition color
- 🧮 **Accurate Scoring** — Full rules: expedition costs, wager multipliers, 8-card bonus
- 📱 **Mobile First** — Installable PWA, optimized for phones
- 🎨 **Color-Coded** — Each expedition color visually distinct
- 🆓 **Free AI** — Uses Google Gemini free tier (1,500 requests/day)

## Scoring Rules

For each expedition (color column):
1. Sum card values − 20 (expedition cost)
2. Multiply by (1 + number of wager cards)
3. Add 20 bonus if 8+ total cards in the expedition

Empty expeditions score 0. Negative scores are possible!

## Getting Started

```bash
pnpm install
```

### Set up AI (optional, for photo scanning)

1. Get a free API key from [Google AI Studio](https://ai.google.dev/)
2. Copy `.env.example` to `.env.local` and add your key:
   ```
   GEMINI_API_KEY=your_key_here
   ```

### Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone or in a mobile browser.

## Tech Stack

- **Next.js 15** (App Router)
- **Tailwind CSS 4** + **shadcn/ui**
- **Google Gemini 2.0 Flash** (free tier vision API)
- **Zod** (validation)
- **Vitest** (testing)

## Testing

```bash
pnpm vitest run
```

20 unit tests covering all scoring edge cases.
