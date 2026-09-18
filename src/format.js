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

export const ago = (iso) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)}d ago`;
};
