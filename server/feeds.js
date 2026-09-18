/**
 * Market Monitor v2 — data feeds.
 *
 * Every feed follows the same contract:
 *   - it returns { ok: true, data } or { ok: false, error, data: null }
 *   - it never throws upward, so one dead API can't blank the dashboard
 *   - it caches, so the browser can poll every 30s without burning quota
 */

const cache = new Map();

/** Run `fn` at most once per `ttlMs`; serve the last good value in between. */
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) return hit.value;
  try {
    const value = { ok: true, data: await fn(), at: new Date().toISOString() };
    cache.set(key, { at: now, value });
    return value;
  } catch (error) {
    // Serve stale data rather than nothing — a 10-minute-old index level
    // is far more useful than an empty card.
    if (hit) return { ...hit.value, stale: true, error: error.message };
    return { ok: false, error: error.message, data: null };
  }
}

async function getJson(url, options) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MarketMonitor/2.0', Accept: 'application/json', ...(options?.headers || {}) }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}: ${text.slice(0, 160)}`);
  return JSON.parse(text);
}

/* ------------------------------------------------------------------ *
 * 1. Indices — Yahoo Finance chart API. No key, no signup.
 *    Called server-side because Yahoo does not send CORS headers.
 * ------------------------------------------------------------------ */

export const INDEX_UNIVERSE = [
  { symbol: '^NSEI',     name: 'NIFTY 50',       exchange: 'NSE · India',        region: 'IN', photo: '/NSE.jpeg' },
  { symbol: '^BSESN',    name: 'SENSEX',         exchange: 'BSE · India',        region: 'IN', photo: '/SENSEX.jpeg' },
  { symbol: '^IXIC',     name: 'NASDAQ',         exchange: 'Nasdaq · New York',  region: 'US', photo: '/NASDAQ.jpeg' },
  { symbol: '^GSPC',     name: 'S&P 500',        exchange: 'NYSE · New York',    region: 'US', photo: '/S&PGlobal.jpeg' },
  { symbol: '^DJI',      name: 'Dow Jones',      exchange: 'NYSE · New York',    region: 'US', photo: '/DJI.jpeg' },
  { symbol: '^FTSE',     name: 'FTSE 100',       exchange: 'LSE · London',       region: 'UK', photo: '/FTSE.jpeg' },
  { symbol: '^N225',     name: 'Nikkei 225',     exchange: 'TSE · Tokyo',        region: 'JP', photo: '/TOKYO.jpeg' },
  { symbol: '^KS11',     name: 'KOSPI',          exchange: 'KRX · Seoul',        region: 'KR', photo: '/KOSPI.jpeg' },
  { symbol: '000001.SS', name: 'SSE Composite',  exchange: 'SSE · Shanghai',     region: 'CN', photo: '/Shanghai.jpeg' },
  { symbol: '^STI',      name: 'STI',            exchange: 'SGX · Singapore',    region: 'SG', photo: '/SGX.jpeg' }
];

/**
 * One call per symbol gives us the level, the day change AND an intraday
 * series for the sparkline — that last part is what the v1 dashboard was
 * missing, and it's free.
 */
async function fetchIndex(entry) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(entry.symbol)}` +
    `?range=1d&interval=5m&includePrePost=false`;
  const json = await getJson(url);
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${entry.symbol}`);

  const meta = result.meta || {};
  const closes = (result.indicators?.quote?.[0]?.close || []).filter((v) => typeof v === 'number');
  const price = meta.regularMarketPrice ?? closes[closes.length - 1];
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? closes[0];
  const change = price - prev;

  return {
    ...entry,
    value: price,
    change,
    changePercent: prev ? (change / prev) * 100 : 0,
    currency: meta.currency,
    marketState: meta.marketState || 'UNKNOWN',
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    // Thin the series to ~60 points so the payload stays small.
    sparkline: thin(closes, 60)
  };
}

function thin(arr, target) {
  if (arr.length <= target) return arr;
  const step = arr.length / target;
  const out = [];
  for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * step)]);
  out.push(arr[arr.length - 1]);
  return out;
}

export function getIndices() {
  return cached('indices', 60_000, async () => {
    const settled = await Promise.allSettled(INDEX_UNIVERSE.map(fetchIndex));
    const rows = settled
      .filter((s) => s.status === 'fulfilled')
      .map((s) => s.value);
    if (!rows.length) throw new Error('All index requests failed');
    return rows;
  });
}

/* ------------------------------------------------------------------ *
 * 2. US macro — FRED. Unchanged from v1 apart from error handling.
 * ------------------------------------------------------------------ */

async function fredLatest(seriesId, units) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error('FRED_API_KEY is not set');
  const url = new URL('https://api.stlouisfed.org/fred/series/observations');
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('sort_order', 'desc');
  url.searchParams.set('limit', '24');
  if (units) url.searchParams.set('units', units);

  const json = await getJson(url.toString());
  const valid = (json.observations || []).filter((o) => o.value !== '.' && !Number.isNaN(Number(o.value)));
  if (!valid.length) throw new Error(`No usable observations for ${seriesId}`);
  return {
    value: Number(valid[0].value),
    date: valid[0].date,
    // v1 showed one number; a 12-point history lets the UI draw the trend.
    history: valid.slice(0, 12).reverse().map((o) => ({ date: o.date, value: Number(o.value) }))
  };
}

export function getUsMacro() {
  return cached('us-macro', 6 * 60 * 60 * 1000, async () => {
    const series = {
      fedFunds: 'FEDFUNDS',
      corePce: 'PCEPILFE',
      cpi: 'CPIAUCSL',
      unemployment: 'UNRATE',
      tenYear: 'DGS10'
    };
    const entries = await Promise.allSettled([
      fredLatest(series.fedFunds),
      fredLatest(series.corePce, 'pc1'),
      fredLatest(series.cpi, 'pc1'),
      fredLatest(series.unemployment),
      fredLatest(series.tenYear)
    ]);
    const [fedFunds, corePce, cpi, unemployment, tenYear] = entries.map((e) =>
      e.status === 'fulfilled' ? e.value : null
    );
    return { fedFunds, corePce, cpi, unemployment, tenYear };
  });
}

/* ------------------------------------------------------------------ *
 * 3. India macro — RBI publishes no open JSON API, so these are
 *    operator-maintained constants. Edit them after each MPC meeting;
 *    `reviewedOn` is rendered in the UI so a stale number is visible.
 * ------------------------------------------------------------------ */

export function getIndiaMacro() {
  return {
    ok: true,
    reviewedOn: '2026-08-08',
    data: {
      repoRate: 5.5,
      standingDepositFacility: 5.25,
      marginalStandingFacility: 5.75,
      crr: 4.0,
      slr: 18.0,
      cpiInflation: 3.2,
      wpiInflation: 2.38,
      unemployment: 5.1,
      stance: 'Neutral'
    }
  };
}

/* ------------------------------------------------------------------ *
 * 4. FX — Twelve Data if a key exists, else the keyless Frankfurter
 *    ECB feed. Fallback means the dashboard still shows rates on a
 *    fresh clone with an empty .env.
 * ------------------------------------------------------------------ */

const FX = ['USD', 'EUR', 'GBP', 'JPY', 'CNY'];

async function fxFromTwelveData() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error('no twelve data key');
  const symbols = FX.map((c) => `${c}/INR`).join(',');
  const json = await getJson(
    `https://api.twelvedata.com/exchange_rate?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`
  );
  return FX.map((code) => {
    const row = json[`${code}/INR`] || json;
    return { code, rate: Number(row.rate), source: 'Twelve Data' };
  }).filter((r) => Number.isFinite(r.rate));
}

async function fxFromFrankfurter() {
  const json = await getJson(`https://api.frankfurter.app/latest?from=INR&to=${FX.join(',')}`);
  return FX.map((code) => ({
    code,
    rate: json.rates?.[code] ? 1 / json.rates[code] : NaN,
    source: 'Frankfurter (ECB)'
  })).filter((r) => Number.isFinite(r.rate));
}

export function getCurrencies() {
  return cached('fx', 10 * 60 * 1000, async () => {
    try {
      return await fxFromTwelveData();
    } catch {
      return await fxFromFrankfurter();
    }
  });
}

/* ------------------------------------------------------------------ *
 * 5. Commodities — gold/silver via Yahoo futures (keyless),
 *    crude via OilPriceAPI when a key exists, else Yahoo futures too.
 * ------------------------------------------------------------------ */

const COMMODITY_SYMBOLS = [
  { symbol: 'GC=F', name: 'Gold', unit: 'USD/oz', photo: '/goldbars.avif' },
  { symbol: 'SI=F', name: 'Silver', unit: 'USD/oz', photo: '/silverbars.jpeg' },
  { symbol: 'CL=F', name: 'WTI Crude', unit: 'USD/bbl', photo: '/crudeoil.webp' },
  { symbol: 'BZ=F', name: 'Brent Crude', unit: 'USD/bbl', photo: '/ship.png' }
];

export function getCommodities() {
  return cached('commodities', 5 * 60 * 1000, async () => {
    const settled = await Promise.allSettled(
      COMMODITY_SYMBOLS.map(async (c) => {
        const row = await fetchIndex({ ...c, exchange: 'Futures', region: 'GLOBAL' });
        return {
          name: c.name, unit: c.unit, photo: c.photo,
          value: row.value, changePercent: row.changePercent,
          dayHigh: row.dayHigh, dayLow: row.dayLow,
          // 1-day, 5-minute sparkline — same series fetchIndex already builds for the indices.
          sparkline: row.sparkline
        };
      })
    );
    const rows = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
    if (!rows.length) throw new Error('No commodity prices available');
    return rows;
  });
}

/* ------------------------------------------------------------------ *
 * 6. News — Google News RSS, keyless. Parsed without an XML library
 *    so the dependency list stays at two packages.
 * ------------------------------------------------------------------ */

const NEWS_TOPICS = [
  { label: 'Markets', query: 'stock market' },
  { label: 'India', query: 'nifty sensex RBI' },
  { label: 'Policy', query: 'federal reserve interest rate' },
  { label: 'Commodities', query: 'crude oil gold price' }
];

async function fetchTopic(topic) {
  const url =
    `https://news.google.com/rss/search?q=${encodeURIComponent(topic.query)}+when:1d` +
    `&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MarketMonitor/2.0' } });
  if (!res.ok) throw new Error(`News HTTP ${res.status}`);
  const xml = await res.text();

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 3).map((m) => {
    const block = m[1];
    const pick = (tag) => {
      const hit = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      if (!hit) return '';
      return hit[1]
        .replace(/^<!\[CDATA\[|\]\]>$/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
        .trim();
    };
    const published = pick('pubDate');
    return {
      topic: topic.label,
      headline: pick('title').replace(/\s-\s[^-]+$/, ''),
      source: pick('source') || 'Google News',
      url: pick('link'),
      publishedAt: published ? new Date(published).toISOString() : null
    };
  });
  return items;
}

export function getNews() {
  return cached('news', 15 * 60 * 1000, async () => {
    const settled = await Promise.allSettled(NEWS_TOPICS.map(fetchTopic));
    const rows = settled.filter((s) => s.status === 'fulfilled').flatMap((s) => s.value);
    if (!rows.length) throw new Error('No headlines returned');
    return rows;
  });
}

/* ------------------------------------------------------------------ *
 * 7. Derived: session clock + risk appetite.
 *    Neither exists in v1 — both are computed here so the email brief
 *    and the web dashboard always agree on the same number.
 * ------------------------------------------------------------------ */

// Exchange hours expressed in IST decimal hours (New York wraps past midnight).
export const SESSIONS = [
  { name: 'Tokyo', open: 5.5, close: 11.5 },
  { name: 'Singapore', open: 6.5, close: 14.5 },
  { name: 'Shanghai', open: 7.0, close: 12.5 },
  { name: 'Mumbai', open: 9.25, close: 15.5 },
  { name: 'London', open: 13.0, close: 21.5 },
  { name: 'New York', open: 19.0, close: 1.5 }
];

export function getSessionClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const hours = Number(get('hour')) + Number(get('minute')) / 60;
  const weekend = get('weekday') === 'Sat' || get('weekday') === 'Sun';

  const sessions = SESSIONS.map((s) => {
    const open = s.close > s.open ? hours >= s.open && hours < s.close : hours >= s.open || hours < s.close;
    return { ...s, open: open && !weekend };
  });

  return {
    istHours: hours,
    weekend,
    nseOpen: !weekend && hours >= 9.25 && hours <= 15.5,
    sessions,
    liveCount: sessions.filter((s) => s.open).length
  };
}

/**
 * Risk appetite, 0–100. Composite of five inputs the dashboard already
 * has, so it needs no extra API call. Each component is reported
 * alongside the score — an unexplained gauge is noise.
 */
export function computeRiskAppetite({ indices, commodities, indiaMacro, usMacro }) {
  const components = [];
  const push = (label, score, detail) =>
    components.push({ label, score: Math.max(0, Math.min(100, score)), detail });

  const rows = indices?.data || [];
  if (rows.length) {
    const green = rows.filter((r) => r.changePercent > 0).length;
    push('Global breadth', (green / rows.length) * 100, `${green} of ${rows.length} benchmarks higher`);
    const avg = rows.reduce((a, r) => a + r.changePercent, 0) / rows.length;
    push('Average move', 50 + avg * 18, `${avg >= 0 ? '+' : ''}${avg.toFixed(2)}% mean change`);
  }

  const crude = (commodities?.data || []).find((c) => c.name === 'WTI Crude');
  if (crude) push('Crude (inverted)', 50 - crude.changePercent * 6, `WTI ${crude.changePercent.toFixed(2)}%`);

  const cpi = indiaMacro?.data?.cpiInflation;
  const repo = indiaMacro?.data?.repoRate;
  if (cpi != null && repo != null) {
    push('India policy room', 100 - Math.max(0, repo - cpi) * 22, `Real repo ${(repo - cpi).toFixed(2)}%`);
  }

  const ff = usMacro?.data?.fedFunds?.value;
  const uscpi = usMacro?.data?.cpi?.value;
  if (ff != null && uscpi != null) {
    push('Fed restriction', 100 - Math.max(0, ff - uscpi) * 24, `Real fed funds ${(ff - uscpi).toFixed(2)}%`);
  }

  const score = components.length
    ? Math.round(components.reduce((a, c) => a + c.score, 0) / components.length)
    : null;

  return {
    score,
    label: score == null ? 'Unavailable' : score >= 65 ? 'Risk on' : score >= 45 ? 'Neutral' : 'Risk off',
    components
  };
}
