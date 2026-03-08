# Lost Cities Scorer – Agent Guide

## Project Overview

A mobile-first PWA for scoring the **Lost Cities** card game. Two input modes: photo scanning (Gemini AI vision) and manual card entry. Built with Next.js 16 (App Router), React 19, Tailwind CSS 4, and shadcn/ui.

## Key Files

| Purpose | Path |
|---|---|
| Home page (single-page flow) | `src/app/page.tsx` |
| Root layout | `src/app/layout.tsx` |
| Global styles + expedition color classes | `src/app/globals.css` |
| Manual scoring UI (player tabs) | `src/components/manual-entry.tsx` |
| Card/wager tap targets per expedition | `src/components/card-selector.tsx` |
| Photo capture + upload | `src/components/photo-capture.tsx` |
| Score results display | `src/components/score-results.tsx` |
| Per-expedition score row | `src/components/expedition-score-row.tsx` |
| shadcn UI primitives | `src/components/ui/*.tsx` |
| Gemini vision client | `src/lib/gemini.ts` |
| AI analysis API route | `src/app/api/analyze/route.ts` |
| Scoring logic | `src/lib/scoring.ts` |
| Types (ExpeditionColor, etc.) | `src/lib/types.ts` |
| Constants (colors, card values, config) | `src/lib/constants.ts` |
| Zod validation for AI response | `src/lib/validation.ts` |
| Tailwind merge utility (`cn()`) | `src/lib/utils.ts` |
| Scoring unit tests | `src/lib/__tests__/scoring.test.ts` |

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router, Turbopack)
- **UI**: React 19, Tailwind CSS 4, shadcn/ui (Base UI + CVA), Lucide icons
- **AI**: `@google/genai` → Gemini 2.5 Flash with vision + structured JSON output
- **Validation**: Zod 4
- **Testing**: Vitest 4

## Styling

- Tailwind utility classes everywhere; no CSS modules
- `cn()` helper from `@/lib/utils` (clsx + tailwind-merge)
- Expedition colors defined in `EXPEDITION_CONFIG` in `src/lib/constants.ts` (hex, Tailwind classes)
- Additional `.expedition-*` CSS classes in `src/app/globals.css`
- Dark mode via CSS variables (oklch) in `:root` / `.dark`

## Environment Variables

- `GEMINI_API_KEY` – required for photo scanning (Gemini API)

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (port 3000) |
| Production build | `npm run build` |
| Run tests | `npx vitest run` |
| Lint | `npm run lint` |

## Cursor Cloud specific instructions

- Start the dev server with `npm run dev` before manual browser testing
- The app runs on `http://localhost:3000`
- Test UI changes at both desktop and mobile (375px) viewport widths
- Photo scanning requires `GEMINI_API_KEY` env var; manual entry works without it
- The app is a single-page flow: start → capture/manual-entry → review → results
