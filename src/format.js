export const num = (n, d = 2) =>
  n == null || Number.isNaN(n)
    ? '—'
    : n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

export const signed = (n, d = 2) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${num(n, d)}`);

export const dirClass = (n) => (n >= 0 ? 'u' : 'd');

const FLAGS = { IN: '🇮🇳', US: '🇺🇸', UK: '🇬🇧', JP: '🇯🇵', KR: '🇰🇷', CN: '🇨🇳', SG: '🇸🇬' };
export const flagFor = (region) => FLAGS[region] || '🏳️';

const BRIEFS = {
  '^NSEI': 'NSE benchmark tracking the 50 largest, most liquid Indian companies by free-float market cap.',
  '^BSESN': "Asia's oldest exchange index — 30 established large-caps that have set India's pulse since 1986.",
  '^NSEBANK': 'A concentrated basket of the biggest listed Indian banks — the most rate-sensitive index on the desk.',
  '^IXIC': 'Nasdaq Composite — heavy in technology and growth names, the barometer for US risk appetite.',
  '^GSPC': 'The S&P 500 — 500 of the largest US companies, the default benchmark for US equities.',
  '^DJI': 'Thirty blue-chip US industrials, price-weighted — the oldest continuously published US index.',
  '^FTSE': 'FTSE 100 — the largest LSE-listed companies, heavy on energy, miners and banks.',
  '^N225': "Nikkei 225 — Japan's headline gauge of 225 leading Tokyo Stock Exchange names.",
  '^KS11': 'KOSPI — South Korea\'s benchmark, dominated by exporters like Samsung and SK Hynix.',
  '000001.SS': 'Shanghai Composite — every A- and B-share listed on the Shanghai Stock Exchange.',
  '^STI': "Straits Times Index — Singapore's benchmark of its most liquid blue-chip names."
};
export const briefFor = (symbol) => BRIEFS[symbol] || 'Benchmark index tracked on this desk.';

// 1 troy ounce = 31.1034768 grams — the standard unit gold/silver futures are quoted in.
export const OZ_TO_KG = 1000 / 31.1034768;

export const COMMODITY_INFO = {
  Gold: {
    blurb: 'A monetary and jewellery metal — mined supply is small relative to above-ground stock, so price moves mostly track investment demand and central-bank buying.',
    exporters: [{ f: '🇨🇳', c: 'China' }, { f: '🇦🇺', c: 'Australia' }, { f: '🇷🇺', c: 'Russia' }],
    importers: [{ f: '🇮🇳', c: 'India' }, { f: '🇨🇳', c: 'China' }, { f: '🇨🇭', c: 'Switzerland' }]
  },
  Silver: {
    blurb: 'Half industrial metal, half store of value — solar panel and electronics demand now rivals investment demand as a price driver.',
    exporters: [{ f: '🇲🇽', c: 'Mexico' }, { f: '🇵🇪', c: 'Peru' }, { f: '🇨🇳', c: 'China' }],
    importers: [{ f: '🇮🇳', c: 'India' }, { f: '🇺🇸', c: 'United States' }, { f: '🇬🇧', c: 'United Kingdom' }]
  },
  'WTI Crude': {
    blurb: 'The US benchmark grade, priced at Cushing, Oklahoma — light and sweet, and the reference for North American crude contracts.',
    exporters: [{ f: '🇺🇸', c: 'United States' }, { f: '🇨🇦', c: 'Canada' }, { f: '🇸🇦', c: 'Saudi Arabia' }],
    importers: [{ f: '🇨🇳', c: 'China' }, { f: '🇮🇳', c: 'India' }, { f: '🇰🇷', c: 'South Korea' }]
  },
  'Brent Crude': {
    blurb: 'The global seaborne benchmark, sourced from North Sea fields — most of the world\'s traded crude is priced off this contract.',
    exporters: [{ f: '🇬🇧', c: 'United Kingdom' }, { f: '🇳🇴', c: 'Norway' }, { f: '🇳🇬', c: 'Nigeria' }],
    importers: [{ f: '🇮🇳', c: 'India' }, { f: '🇨🇳', c: 'China' }, { f: '🇩🇪', c: 'Germany' }]
  }
};

export const ago = (iso) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)}d ago`;
};
