import { useEffect, useRef, useState } from 'react';
import Sparkline from './components/Sparkline.jsx';
import { useSnapshot, useIstClock } from './useSnapshot.js';
import { num, signed, dirClass, ago, flagFor, briefFor, OZ_TO_KG, COMMODITY_INFO } from './format.js';

export default function App() {
  const { data, error, loading, secondsToRefresh } = useSnapshot();
  const ist = useIstClock();

  if (loading) return <Splash message="Pulling the tape…" />;
  if (error && !data) return <Splash message={`Feed unavailable — ${error}`} tone="down" />;

  const indices = data.indices?.data || [];
  const india = indices.filter((i) => i.region === 'IN');
  const global = indices
    .filter((i) => i.region !== 'IN')
    .sort((a, b) => b.changePercent - a.changePercent);
  const usdInr = (data.currencies?.data || []).find((r) => r.code === 'USD')?.rate;

  return (
    <>
      <div className="scrim" />
      <Rail ist={ist} clock={data.clock} seconds={secondsToRefresh} />
      <Navbar />
      <Tape indices={indices} currencies={data.currencies?.data} commodities={data.commodities?.data} />

      <div className="wrap">
        <Hero risk={data.risk} generatedAt={data.generatedAt} indices={indices} />

        <Section id="markets" title="Indian Indices" note="Benchmark levels, intraday shape and the day's range.">
          <div className="india">
            {india.map((m) => <IndexCard key={m.symbol} m={m} />)}
          </div>
        </Section>

        <Section title="Global Indices" note="Ranked by today's move, not by index size.">
          <div className="gg">
            {global.map((g) => <GlobalCard key={g.symbol} g={g} />)}
          </div>
        </Section>

        <Section title="Session clock" note="Every exchange on one 24-hour Indian trading day.">
          <SessionClock clock={data.clock} />
        </Section>

        <Section title="Policy desk" note="The two rate-setters that price everything above.">
          <div className="policy">
            <RbiPanel macro={data.indiaMacro} />
            <FedPanel macro={data.usMacro} />
          </div>
        </Section>

        <Section title="Commodities & currency" note="The two inputs that turn a global move into an Indian one.">
          <div className="two">
            <div className="tiles" id="commodities">
              {(data.commodities?.data || []).map((c) => (
                <CommodityTile key={c.name} c={c} usdInr={usdInr} />
              ))}
            </div>
            <div id="currencies"><FxTable rows={data.currencies?.data} /></div>
          </div>
        </Section>

        <Section id="news" title="What moved the tape" note="Live headlines from Google News, grouped by desk.">
          <div className="news">
            {(data.news?.data || []).slice(0, 8).map((n, i) => (
              <a className="nitem" key={i} href={n.url} target="_blank" rel="noreferrer">
                <div className="meta">
                  <span className="src">{n.topic}</span>
                  <span className="t">{ago(n.publishedAt)}</span>
                </div>
                <h4>{n.headline}</h4>
                <div className="tags"><span className="tag">{n.source}</span></div>
              </a>
            ))}
          </div>
        </Section>

        <footer className="wrap" style={{ paddingInline: 0 }}>
          <div className="srcs">
            <span>YAHOO FINANCE — indices, commodities</span>
            <span>FRED — US macro</span>
            <span>{data.currencies?.data?.[0]?.source?.toUpperCase() || 'FX'} — currency</span>
            <span>GOOGLE NEWS — headlines</span>
            <span>RBI — policy (reviewed {data.indiaMacro?.reviewedOn})</span>
          </div>
          <p style={{ marginTop: 14, maxWidth: '70ch' }}>
            Snapshot generated {ago(data.generatedAt)}. Figures are for information only, not investment advice.
          </p>
        </footer>
      </div>
    </>
  );
}

/* ------------------------------- pieces ------------------------------- */

function Splash({ message, tone }) {
  return (
    <div className="wrap" style={{ paddingBlock: 120 }}>
      <span className="eyebrow">Market Monitor</span>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 400, marginTop: 10,
                   color: tone === 'down' ? 'var(--down)' : 'var(--txt)' }}>
        {message}
      </h1>
    </div>
  );
}

function Rail({ ist, clock, seconds }) {
  const open = clock?.nseOpen;
  return (
    <div className="rail"><div className="wrap rail-in">
      <div className="brand">
        <span className="mark" /><b>Market Monitor</b><span>v2 · terminal</span>
      </div>
      <div className="clock">{ist} <small>IST</small></div>
      <div className="status">
        <i className="pulse" style={{ background: open ? 'var(--up)' : 'var(--down)' }} />
        {open ? 'NSE open' : clock?.weekend ? 'Weekend · closed' : 'NSE closed'}
      </div>
      <div className="status" style={{ borderColor: 'var(--line)' }}>
        <i style={{ background: 'var(--ember)' }} />
        Next refresh <span className="num" style={{ marginLeft: 4 }}>{seconds}s</span>
      </div>
    </div></div>
  );
}

function Tape({ indices = [], currencies = [], commodities = [] }) {
  const items = [
    ...indices.map((i) => ({ n: i.name, v: i.value, p: i.changePercent })),
    ...commodities.map((c) => ({ n: c.name, v: c.value, p: c.changePercent })),
    ...currencies.map((c) => ({ n: `${c.code}/INR`, v: c.rate, p: 0 }))
  ];
  const row = items.map((i, k) => (
    <span className="tick" key={k}>
      <b>{i.n}</b><span>{num(i.v)}</span>
      {i.p ? <span className={i.p >= 0 ? 'up' : 'down'}>{signed(i.p)}%</span> : null}
    </span>
  ));
  return <div className="tape"><div className="tape-track">{row}{row}</div></div>;
}

function Hero({ risk, generatedAt, indices }) {
  const green = indices.filter((i) => i.changePercent > 0).length;
  const score = risk?.score ?? 50;
  return (
    <div className="hero" id="overview"><div className="hero-grid">
      <div>
        <span className="eyebrow">
          Snapshot · {new Date(generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <h1>{risk?.label === 'Risk on' ? <>Risk is on, and <em>breadth agrees</em>.</>
          : risk?.label === 'Risk off' ? <>The bid has <em>stepped away</em>.</>
          : <>Mixed tape, <em>no conviction</em>.</>}</h1>
        <p>
          {green} of {indices.length} tracked benchmarks are higher. The risk score below is computed
          from breadth, the average move, crude, and how much room each central bank has left —
          the same number the twice-daily email brief leads with.
        </p>
      </div>
      <div className="regime">
        <div className="regime-head">
          <div>
            <span className="eyebrow">Risk appetite</span>
            <div className="regime-val" style={{ color: score >= 65 ? 'var(--up)' : score >= 45 ? 'var(--warn)' : 'var(--down)' }}>
              {score}
            </div>
          </div>
          <span className={`chip ${score >= 50 ? 'u' : 'd'}`}>{risk?.label}</span>
        </div>
        <div className="meter"><i style={{ left: `${score}%` }} /></div>
        <div className="meter-lab"><span>Fear</span><span>Neutral</span><span>Greed</span></div>
        <div className="regime-rows">
          {(risk?.components || []).map((c) => (
            <div className="rrow" key={c.label}>
              <span title={c.detail}>{c.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="rbar">
                  <i style={{ width: `${c.score}%`, background: c.score >= 60 ? 'var(--up)' : c.score >= 40 ? 'var(--warn)' : 'var(--down)' }} />
                </div>
                <b className="num" style={{ fontSize: 11, fontWeight: 500, width: 30, textAlign: 'right' }}>
                  {Math.round(c.score)}
                </b>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div></div>
  );
}

function Section({ id, title, note, children }) {
  return (
    <section id={id}>
      <div className="sec-head"><div><h2>{title}</h2><p>{note}</p></div></div>
      {children}
    </section>
  );
}

function Navbar() {
  return (
    <nav className="navbar"><div className="wrap navbar-in">
      <div className="navlinks">
        <a className="navlink active" href="#overview"><i className="fa-solid fa-chart-line" /> Overview</a>
        <a className="navlink" href="#markets"><i className="fa-solid fa-building-columns" /> Markets</a>
        <a className="navlink" href="#commodities"><i className="fa-solid fa-coins" /> Commodities</a>
        <a className="navlink" href="#currencies"><i className="fa-solid fa-money-bill-transfer" /> Currencies</a>
        <a className="navlink" href="#news"><i className="fa-solid fa-newspaper" /> News</a>
      </div>
      <label className="navsearch">
        <i className="fa-solid fa-magnifying-glass" />
        <input type="text" placeholder="Search markets, assets, news, etc...." />
      </label>
      <ProfileMenu />
    </div></nav>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="profile" ref={ref}>
      <button className="profile-btn" onClick={() => setOpen((o) => !o)} aria-label="Account menu">
        <span className="avatar">GU</span>
      </button>
      {open && (
        <div className="profile-menu">
          <div className="profile-head">
            <span className="avatar lg">GU</span>
            <div>
              <b>Guest User</b>
              <span className="eyebrow">Viewing as guest</span>
            </div>
          </div>
          <a className="menu-item" href="#"><i className="fa-solid fa-id-card" /> Profile Details</a>
          <a className="menu-item" href="#"><i className="fa-solid fa-briefcase" /> Portfolio Information</a>
          <a className="menu-item" href="#"><i className="fa-solid fa-location-dot" /> Location Based Analysis</a>
          <button className="menu-item logout"><i className="fa-solid fa-right-from-bracket" /> Log Out</button>
        </div>
      )}
    </div>
  );
}

function IndexCard({ m }) {
  const up = m.changePercent >= 0;
  const range = m.dayHigh && m.dayLow ? ((m.value - m.dayLow) / (m.dayHigh - m.dayLow)) * 100 : null;
  return (
    <div className="big" style={{ '--photo': `url(${m.photo})` }}>
      <div className="big-top">
        <div>
          <div className="big-name"><span className="flag">{flagFor(m.region)}</span>{m.name}</div>
          <div className="big-val">{num(m.value)}</div>
          <div className={`num ${up ? 'up' : 'down'}`} style={{ fontSize: 12.5, marginTop: 4 }}>
            {signed(m.change)} pts
          </div>
        </div>
        <span className={`chip ${dirClass(m.changePercent)}`}>{signed(m.changePercent)}%</span>
      </div>
      <Sparkline data={m.sparkline} up={up} fill />
      {range != null && (
        <div className="breadth">
          <div className="breadth-bar">
            <i style={{ width: `${range}%`, background: up ? 'var(--up)' : 'var(--down)' }} />
          </div>
          <div className="breadth-lab">
            <span>LOW {num(m.dayLow)}</span><span>HIGH {num(m.dayHigh)}</span>
          </div>
        </div>
      )}
      <CardPreview m={m} up={up} />
    </div>
  );
}

function GlobalCard({ g }) {
  const up = g.changePercent >= 0;
  return (
    <div className="gcard" style={{ '--photo': `url(${g.photo})` }}>
      <div className="ex">{g.exchange}</div>
      <div className="nm"><span className="flag">{flagFor(g.region)}</span>{g.name}</div>
      <div className="vl">{num(g.value)}</div>
      <div style={{ marginTop: 10 }}>
        <Sparkline data={g.sparkline} up={up} height={34} />
      </div>
      <div className="foot">
        <span className="sess"><i />{g.marketState === 'REGULAR' ? 'open' : 'closed'}</span>
        <span className={`chip ${dirClass(g.changePercent)}`}>{signed(g.changePercent)}%</span>
      </div>
      <CardPreview m={g} up={up} />
    </div>
  );
}

/** Two-pane hover readout: brief + key stats on the left, a larger chart on the right. */
function CardPreview({ m, up }) {
  return (
    <div className="preview">
      <div className="preview-left">
        <span className="flag">{flagFor(m.region)}</span>
        <h3>{m.name}</h3>
        <span className="eyebrow">{m.exchange}</span>
        <p>{briefFor(m.symbol)}</p>
        <div className="preview-stats">
          <div><span>Last</span><b className="num">{num(m.value)}</b></div>
          <div><span>Change</span><b className={`num ${up ? 'up' : 'down'}`}>{signed(m.change)} pts · {signed(m.changePercent)}%</b></div>
          {m.dayHigh != null && <div><span>Day range</span><b className="num">{num(m.dayLow)} – {num(m.dayHigh)}</b></div>}
          <div><span>Session</span><b>{m.marketState === 'REGULAR' ? 'Open' : 'Closed'}</b></div>
        </div>
      </div>
      <div className="preview-right">
        <span className="eyebrow">Intraday, 5-minute bars</span>
        <Sparkline data={m.sparkline} up={up} fill height={220} />
      </div>
    </div>
  );
}

function CommodityTile({ c, usdInr }) {
  const up = c.changePercent >= 0;
  const isMetal = c.unit.includes('oz');
  const unit = isMetal ? 'kg' : 'bbl';
  const usdPerUnit = isMetal ? c.value * OZ_TO_KG : c.value;
  const inrPerUnit = usdInr ? usdPerUnit * usdInr : null;

  return (
    <div className="gcard" style={{ '--photo': `url(${c.photo})` }}>
      <div className="ex">{isMetal ? 'COMEX' : 'NYMEX / ICE'} · FUTURES</div>
      <div className="nm">{c.name}</div>
      <div className="vl">{inrPerUnit != null ? `₹${num(inrPerUnit)}` : `$${num(usdPerUnit)}`} <small style={{ color: 'var(--dim2)', fontSize: 11 }}>/{unit}</small></div>
      <div className="num" style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
        ${num(usdPerUnit)}/{unit}
      </div>
      <div style={{ marginTop: 10 }}>
        <Sparkline data={c.sparkline} up={up} height={34} />
      </div>
      <div className="foot">
        <span className="sess"><i />1D</span>
        <span className={`chip ${dirClass(c.changePercent)}`}>{signed(c.changePercent)}%</span>
      </div>
      <CommodityPreview c={c} up={up} isMetal={isMetal} unit={unit} usdPerUnit={usdPerUnit} inrPerUnit={inrPerUnit} />
    </div>
  );
}

function CommodityPreview({ c, up, isMetal, unit, usdPerUnit, inrPerUnit }) {
  const info = COMMODITY_INFO[c.name] || {};
  return (
    <div className="preview">
      <div className="preview-left">
        <h3>{c.name}</h3>
        <span className="eyebrow">{isMetal ? 'COMEX' : 'NYMEX / ICE'} futures</span>
        <p>{info.blurb}</p>
        <div className="preview-stats">
          <div><span>Price</span><b className="num">{inrPerUnit != null ? `₹${num(inrPerUnit)}/${unit}` : '—'}</b></div>
          <div><span>USD equiv</span><b className="num">${num(usdPerUnit)}/{unit}</b></div>
          <div><span>Change</span><b className={`num ${up ? 'up' : 'down'}`}>{signed(c.changePercent)}%</b></div>
          {c.dayHigh != null && <div><span>Day range</span><b className="num">{num(c.dayLow)} – {num(c.dayHigh)} {c.unit}</b></div>}
        </div>
        <div className="tradeflow">
          <div>
            <span className="eyebrow">Top exporters</span>
            <div className="flagrow">{(info.exporters || []).map((x) => <span key={x.c}>{x.f} {x.c}</span>)}</div>
          </div>
          <div>
            <span className="eyebrow">Top importers</span>
            <div className="flagrow">{(info.importers || []).map((x) => <span key={x.c}>{x.f} {x.c}</span>)}</div>
          </div>
        </div>
      </div>
      <div className="preview-right">
        <span className="eyebrow">1D trend · 5-minute bars</span>
        <Sparkline data={c.sparkline} up={up} fill height={220} />
      </div>
    </div>
  );
}

function SessionClock({ clock }) {
  const now = (clock.istHours / 24) * 100;
  const live = clock.sessions.filter((s) => s.open).map((s) => s.name);
  return (
    <div className="clockwrap">
      <div className="tl">
        {clock.sessions.map((s) => {
          const segs = s.close > s.open ? [[s.open, s.close]] : [[s.open, 24], [0, s.close]];
          return (
            <div className="tlrow" key={s.name}>
              <span className="tlname" style={{ color: s.open ? 'var(--txt)' : 'var(--dim2)' }}>{s.name}</span>
              <div className="tlbar">
                {segs.map((sg, i) => (
                  <i key={i} style={{
                    left: `${(sg[0] / 24) * 100}%`,
                    width: `${((sg[1] - sg[0]) / 24) * 100}%`,
                    background: s.open ? 'var(--ember)' : 'var(--line2)'
                  }} />
                ))}
                <span className="tlnow" style={{ left: `${now}%` }} />
              </div>
            </div>
          );
        })}
        <div className="tlaxis">
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
        </div>
      </div>
      <div className="overlap">
        <h3>{live.length > 1 ? live.slice(0, 2).join(' + ') : live[0] || 'All desks dark'}</h3>
        <p>
          {live.length > 1
            ? `${live.length} exchanges are trading at once. Overlaps carry the deepest books of the day — spreads tighten and moves transmit across markets within minutes.`
            : live.length === 1
              ? `${live[0]} alone has the tape. This price sets the overnight reference the next session opens against.`
              : 'No major exchange is trading. Futures and FX carry the price until Tokyo opens at 05:30 IST.'}
        </p>
      </div>
    </div>
  );
}

function RbiPanel({ macro }) {
  const d = macro?.data || {};
  const real = d.repoRate - d.cpiInflation;
  const rows = [
    ['Standing deposit facility', d.standingDepositFacility],
    ['Marginal standing facility', d.marginalStandingFacility],
    ['CRR', d.crr], ['SLR', d.slr],
    ['CPI inflation', d.cpiInflation], ['WPI inflation', d.wpiInflation],
    ['Unemployment', d.unemployment]
  ];
  return (
    <div className="cb">
      <div className="cb-head">
        <div><span className="eyebrow">RBI · Mumbai</span><h3>Reserve Bank of India</h3></div>
        <span className={`chip ${real > 1.5 ? 'd' : 'u'}`}>Real {signed(real)}%</span>
      </div>
      <span className="eyebrow">Repo rate</span>
      <div className="policy-rate">
        <b style={{ color: 'var(--ember)' }}>{num(d.repoRate)}%</b>
        <span style={{ color: 'var(--dim)', fontSize: 13 }}>{d.stance} · on hold</span>
      </div>
      <Ladder rows={rows} accent="var(--ember)" scale={20} />
      <div className="asof">Operator-maintained · last reviewed {macro?.reviewedOn}</div>
    </div>
  );
}

function FedPanel({ macro }) {
  const d = macro?.data || {};
  const ff = d.fedFunds?.value;
  const real = ff != null && d.cpi?.value != null ? ff - d.cpi.value : null;
  const rows = [
    ['Core PCE (y/y)', d.corePce?.value],
    ['Headline CPI (y/y)', d.cpi?.value],
    ['Unemployment', d.unemployment?.value],
    ['10Y Treasury', d.tenYear?.value]
  ];
  return (
    <div className="cb">
      <div className="cb-head">
        <div><span className="eyebrow">FOMC · Washington</span><h3>US Federal Reserve</h3></div>
        {real != null && <span className={`chip ${real > 1.5 ? 'd' : 'u'}`}>Real {signed(real)}%</span>}
      </div>
      <span className="eyebrow">Fed funds (effective)</span>
      <div className="policy-rate">
        <b style={{ color: 'var(--cool)' }}>{ff != null ? `${num(ff)}%` : '—'}</b>
        <span style={{ color: 'var(--dim)', fontSize: 13 }}>
          {macro?.ok ? `as of ${d.fedFunds?.date || ''}` : 'FRED key not set'}
        </span>
      </div>
      <Ladder rows={rows} accent="var(--cool)" scale={10} />
      <div className="asof">FRED series FEDFUNDS · PCEPILFE · CPIAUCSL · UNRATE · DGS10</div>
    </div>
  );
}

function Ladder({ rows, accent, scale }) {
  return (
    <div className="ladder">
      {rows.filter(([, v]) => v != null).map(([label, value]) => (
        <div className="lrow" key={label}>
          <span>{label}</span>
          <span className="v">{num(value)}</span>
          <div className="lbar">
            <i style={{ width: `${Math.min(100, (value / scale) * 100)}%`, background: accent }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FxTable({ rows = [] }) {
  return (
    <div className="fxtable">
      <div className="fxrow" style={{ background: 'var(--panel2)' }}>
        <span className="eyebrow">CCY</span>
        <span className="eyebrow">Pair</span>
        <span className="eyebrow" style={{ textAlign: 'right' }}>Rate ₹</span>
        <span className="eyebrow" style={{ textAlign: 'right' }}>Src</span>
      </div>
      {rows.map((f) => (
        <div className="fxrow" key={f.code}>
          <span className="code">{f.code}</span>
          <span className="lbl">{f.code} / INR</span>
          <span className="rate">{num(f.rate)}</span>
          <span className="chg" style={{ color: 'var(--dim2)', fontSize: 9.5 }}>
            {f.source?.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>
  );
}
