# Market Monitor v2

React + Vite front end on an Express data layer. Upgrade path from the v1
Apps Script / static-HTML dashboard.

## What changed from v1

| v1 | v2 |
|---|---|
| Index levels hardcoded in `server.js` | Live from Yahoo Finance chart API — **no key required** |
| No intraday history | 5-minute bars per index, drawn as canvas sparklines |
| Static HTML string in `public/index.html` | React components, one source of truth for the design tokens |
| Sequential `await`s; one dead API returned a 500 | All feeds run in parallel; each returns `{ok:false}` independently |
| No caching — every page load hit every API | Per-feed TTL cache with stale-while-error fallback |
| Placeholder news array | Live Google News RSS, parsed server-side, keyless |
| FX required a Twelve Data key | Twelve Data if keyed, else Frankfurter (ECB), keyless |
| — | **Risk appetite score** computed from breadth, average move, crude and central-bank headroom |
| — | **Session clock** — all six exchanges on one 24-hour IST timeline |
| — | Day-range bar per Indian index |

## Run

```bash
npm install
cp .env.example .env     # optional — every feed degrades gracefully without keys
npm run dev              # API on :3000, Vite on :5173 with /api proxied
```

Production:

```bash
npm run build && npm start   # Express serves dist/ on :3000
```

## Keys

All optional. Without any `.env` at all you still get indices, commodities,
FX, news, the session clock and the risk score. Keys only add:

- `FRED_API_KEY` — US macro panel (free, instant: fred.stlouisfed.org/docs/api/api_key.html)
- `TWELVE_DATA_API_KEY` — swaps the FX source from ECB daily to intraday
- `OILPRICE_API_KEY` — reserved; crude currently comes from Yahoo futures

## Structure

```
server/
  feeds.js     every data source, each isolated and cached
  index.js     one /api/snapshot endpoint, parallel fetch
src/
  App.jsx      page composition
  useSnapshot.js  30s poll + countdown + IST clock hooks
  components/Sparkline.jsx
  styles.css   design tokens (ink / ember / up / down) and layout
  format.js    en-IN number formatting
```

## Next

- **Custom portfolio** — accept a holdings list, re-weight the brief to the
  user's book. Add a `/api/portfolio` POST and reuse `computeRiskAppetite`
  over the holdings instead of the index universe.
- **Threshold alerts** — the cache in `feeds.js` already sees every tick;
  compare against stored thresholds inside `cached()` and fire from there.
- **Email brief** — `GET /api/snapshot` is the same payload the twice-daily
  mail should render, so the web page and the email can never disagree.
