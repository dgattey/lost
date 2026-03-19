# Manual test walkthrough — score flows & round edit

This app has **two separate UIs** for changing cards:

| Flow | Route(s) | Component | `rounds.length` key? |
|------|-----------|-----------|---------------------|
| **New round** (photo / manual) | `/score`, `/score/photo`, `/score/manual` | `ScorePageClient` | **Yes** — remount when length changes so round *N+1* never inherits round *N* results state |
| **Edit existing round** | `/round/[id]` | `RoundDetailPage` + `ManualEntry` | **No** — does not use `ScorePageClient` at all |

So **going back to edit Round 1** after scoring Round 2 does **not** interact with `score-manual-route` / `score-photo-route`. It only uses `updateRound` in `round/[id]/page.tsx`.

---

## Scenario A — Empty → manual Round 1 → home → manual Round 2

1. Open `/` (or hard refresh). Expect empty state with Scan / Manual CTAs.
2. Tap **Enter Cards Manually** (or **Manual entry** from dashboard after a round exists).
3. Expect **ManualEntry** (Player 1 / Player 2 tabs), **no** photo upload (unless you came from a photo flow with a board image).
4. Enter some cards → **Calculate Score** → **Save Round** → expect redirect to `/`.
5. Expect dashboard with **Round 1** in the list; CTAs show **Round 2**.
6. Tap **Manual entry — Round 2** (`/score/manual`).
7. Expect **fresh** manual entry (not results from round 1). Key is `score-manual-1` after first save (`rounds.length === 1`).

## Scenario B — Edit Round 1 after Round 2 exists

1. Complete Scenario A so **two rounds** exist (`rounds.length === 2`).
2. From `/`, tap **Round 1** card → `/round/1`.
3. Expect round summary + **Edit cards** (via `ScoreResults`).
4. Tap **Edit cards** → expect **Edit Round 1** header and `ManualEntry` prefilled from round 1.
5. Change a card → **Calculate Score** → expect return to round detail with updated totals; **Round 2** unchanged in list when you go home.
6. No navigation through `/score/manual` is required; **no** dependency on `score-manual-${rounds.length}` remount logic.

## Scenario C — Photo Round 1 → manual Round 2

1. From `/`, **Scan Board Photo** → `/score/photo` → complete or cancel to manual if no API key.
2. Save round 1 from results.
3. **Manual entry — Round 2** → expect clean manual flow (`score-manual-1` remount).

## Scenario D — `/score` picker (no query)

1. Open `/score` directly. Expect compact picker + photo note.
2. Links go to `/score/photo` and `/score/manual`. After each saved round, `score-index-${rounds.length}` changes so returning to `/score` after a game does not keep old picker-adjacent state in a stuck `ScorePageClient` (same remount pattern).

## Scenario E — Swap players on round detail

1. Open `/round/1`, tap **Swap Players**. Expect scores recomputed; still no `ScorePageClient`.

## Known limitations (by design)

- **Same `rounds.length`, same score sub-route**: If you abandon mid-flow on `/score/manual` without saving, then return to `/score/manual` with the **same** `rounds.length`, React may reuse the instance (same `key`). Use back/forward or start over from `/` if UI looks stuck.
- **bf-cache**: Rare browser back/forward edge cases; remount key fixes the common “saved round then score next round” path.

---

## Quick regression checklist

- [ ] Empty home → manual → save → home → manual shows **entry**, not **results**
- [ ] Two rounds → open Round 1 → Edit cards → save → home totals/list correct
- [ ] New game clears rounds; manual round 1 again works
- [ ] Purple toggle still affects expedition colors in manual entry
