import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getIndices, getUsMacro, getIndiaMacro, getCurrencies,
  getCommodities, getNews, getSessionClock, computeRiskAppetite
} from './feeds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

/**
 * One endpoint, one payload. v1 made the browser wait on several
 * sequential awaits inside a single handler; here every feed runs in
 * parallel and a failure in one becomes { ok:false } on that key
 * instead of a 500 for the whole page.
 */
app.get('/api/snapshot', async (_req, res) => {
  const [indices, usMacro, currencies, commodities, news] = await Promise.all([
    getIndices(), getUsMacro(), getCurrencies(), getCommodities(), getNews()
  ]);
  const indiaMacro = getIndiaMacro();

  res.json({
    generatedAt: new Date().toISOString(),
    clock: getSessionClock(),
    risk: computeRiskAppetite({ indices, commodities, indiaMacro, usMacro }),
    indices, usMacro, indiaMacro, currencies, commodities, news
  });
});

// Kept for the v1 email script and any bookmark that still points here.
app.get('/api/market-status', (_req, res) => {
  const clock = getSessionClock();
  res.json({
    status: clock.nseOpen ? 'OPEN' : 'CLOSED',
    message: clock.nseOpen ? 'Market Open' : clock.weekend ? 'Weekend · Closed' : 'Market Closed',
    clock
  });
});

// Serve the built React app in production.
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.use((_req, res) => res.sendFile(path.join(__dirname, '..', 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`Market Monitor API on http://localhost:${PORT}`);
});
