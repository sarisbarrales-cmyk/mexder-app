/* ===================== NÚCLEO: estado, datos, indicadores ===================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const isNum = (x) => typeof x === 'number' && isFinite(x);
const fmt = (x, d = 2) => isNum(x) ? x.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const pct = (x, d = 2) => isNum(x) ? fmt(Math.abs(x * 100) < 0.5 * 10 ** -d ? 0 : x * 100, d) + '%' : '—';
const money = (x, d = 2) => x === Infinity ? 'Ilimitada' : x === -Infinity ? 'Ilimitada' : isNum(x) ? (x < 0 ? '−$' : '$') + fmt(Math.abs(x), d) : '—';
const big = (x) => { if (!isNum(x)) return '—'; const a = Math.abs(x), s = x < 0 ? '−' : ''; if (a >= 1e9) return s + fmt(a / 1e9, 2) + ' mil M'; if (a >= 1e6) return s + fmt(a / 1e6, 1) + ' M'; if (a >= 1e3) return s + fmt(a / 1e3, 1) + ' k'; return s + fmt(a, 0); };
const cls = (x) => isNum(x) ? (x > 0 ? 'pos' : x < 0 ? 'neg' : '') : '';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('mxd:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mxd:' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600); }

const EMISORAS = [
  ['AMXB.MX', 'América Móvil B', 18.2], ['CEMEXCPO.MX', 'Cemex CPO', 14.6], ['FEMSAUBD.MX', 'FEMSA UBD', 172], ['GFNORTEO.MX', 'Banorte O', 158],
  ['GMEXICOB.MX', 'Grupo México B', 132], ['WALMEX.MX', 'Walmart de México', 58.4], ['ALFAA.MX', 'Alfa A', 14.1], ['BIMBOA.MX', 'Grupo Bimbo A', 56],
  ['KOFUBL.MX', 'Coca-Cola FEMSA', 168], ['GAPB.MX', 'GAP B', 395], ['ASURB.MX', 'ASUR B', 560], ['ORBIA.MX', 'Orbia', 15.2],
  ['TLEVISACPO.MX', 'Televisa CPO', 9.1], ['GCARSOA1.MX', 'Grupo Carso A1', 128], ['PE&OLES.MX', 'Peñoles', 420],
];
const BENCH = '^MXX';

const S = {
  symbol: store.get('symbol', 'WALMEX.MX'), name: '', currency: 'MXN',
  cycle: store.get('cycle', 'D'), nDays: store.get('ndays', 10), years: 3,
  from: '', to: '', all: [], bench: [], divs: [], fund: null, live: false, fundLive: false,
  view: store.get('view', 'tec'),
};

// ---------- Ciclos ----------
function ppy() { return { D: 252, W: 52, M: 12, N: 252 / S.nDays }[S.cycle]; }
function cycleName() { return { D: 'diario', W: 'semanal', M: 'mensual', N: `cada ${S.nDays} días` }[S.cycle]; }
function isoWeekKey(d) { const t = new Date(d + 'T00:00:00Z'); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day); return t.toISOString().slice(0, 10); }
function resample(rows, cycle, n) {
  if (cycle === 'D' || !rows.length) return rows.slice();
  const out = []; let cur = null, key = null, cnt = 0;
  rows.forEach((r, i) => {
    const k = cycle === 'W' ? isoWeekKey(r.d) : cycle === 'M' ? r.d.slice(0, 7) : Math.floor(i / n);
    if (k !== key) { if (cur) out.push(cur); key = k; cur = { ...r }; cnt = 1; }
    else { cur.h = Math.max(cur.h, r.h); cur.l = Math.min(cur.l, r.l); cur.c = r.c; cur.ac = r.ac; cur.v += r.v; cur.d = r.d; cnt++; }
  });
  if (cur) out.push(cur);
  return out;
}
function inRange(rows) { return rows.filter((r) => (!S.from || r.d >= S.from) && (!S.to || r.d <= S.to)); }
function bars() { return inRange(resample(S.all, S.cycle, S.nDays)); }
function benchBars() { return inRange(resample(S.bench, S.cycle, S.nDays)); }

// ---------- Datos: API (Vercel) o demostración ----------
async function fetchJSON(url, ms = 12000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); const ct = r.headers.get('content-type') || ''; if (!ct.includes('json')) throw new Error('sin JSON'); return await r.json(); }
  finally { clearTimeout(t); }
}
function businessDays(nYears) {
  const out = [], end = new Date(); end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - nYears * 365.25 * 864e5);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) out.push(d.toISOString().slice(0, 10)); }
  return out;
}
function demoSeries(symbol, years) {
  const days = businessDays(years), seed = Q.hashStr(symbol), r = Q.rng(seed), rb = Q.rng(777);
  const meta = EMISORAS.find((e) => e[0] === symbol);
  const endPx = meta ? meta[2] : 20 + (seed % 200);
  const beta = 0.6 + (seed % 70) / 100, sIdio = 0.011 + (seed % 9) / 1000;
  const bench = [], stock = [];
  let b = 50000, sLog = 0, regime = 0, regLeft = 0;
  const rets = [];
  for (let i = 0; i < days.length; i++) {
    if (regLeft <= 0) { regime = (r() - 0.48) * 0.0024; regLeft = 40 + Math.floor(r() * 120); }
    regLeft--;
    const rbm = 0.0003 + 0.0095 * Q.gauss(rb);
    const rs = regime + beta * rbm + sIdio * Q.gauss(r);
    b *= Math.exp(rbm); bench.push(b); rets.push(rs);
  }
  const total = rets.reduce((s, x) => s + x, 0); let lp = Math.log(endPx) - total;
  let prev = Math.exp(lp);
  days.forEach((d, i) => {
    lp += rets[i]; const c = Math.exp(lp), dv = sIdio * 1.1;
    const o = prev * Math.exp(dv * 0.35 * Q.gauss(r));
    const h = Math.max(o, c) * Math.exp(Math.abs(Q.gauss(r)) * dv * 0.55);
    const l = Math.min(o, c) * Math.exp(-Math.abs(Q.gauss(r)) * dv * 0.55);
    stock.push({ d, o, h, l, c, ac: c, v: Math.round(Math.exp(15 + 0.5 * Q.gauss(r)) * (1 + Math.abs(rets[i]) * 40)) });
    prev = c;
  });
  const bRows = days.map((d, i) => ({ d, o: bench[i], h: bench[i], l: bench[i], c: bench[i], ac: bench[i], v: 0 }));
  const divs = [];
  stock.forEach((x, i) => { const m = x.d.slice(5, 7); if ((m === '05' || m === '11') && stock[i - 1] && stock[i - 1].d.slice(5, 7) !== m) divs.push({ d: x.d, amount: +(x.c * 0.0125).toFixed(3) }); });
  return { rows: stock, bench: bRows, divs, name: meta ? meta[1] : symbol };
}
function demoFundamentals(symbol, price) {
  const seed = Q.hashStr(symbol + 'f'), r = Q.rng(seed);
  const shares = (1 + (seed % 30) / 2) * 1e9;
  const mcap = price * shares;
  const rev0 = mcap * (0.6 + r() * 0.8), g = 0.04 + r() * 0.06;
  const gm = 0.25 + r() * 0.2, om = 0.09 + r() * 0.1, nm = om * 0.62;
  const annual = [];
  const yNow = new Date().getFullYear();
  for (let k = 4; k >= 0; k--) {
    const f = Math.pow(1 + g, -k) * (1 + (r() - 0.5) * 0.04), rev = rev0 * f / (1 + g);
    const gp = rev * gm, oi = rev * om, ni = rev * nm, da = rev * 0.04, ta = rev * 1.25, eq = ta * 0.45, debt = ta * 0.25;
    annual.push({
      date: `${yNow - 1 - k}-12-31`, totalRevenue: rev, costOfRevenue: rev - gp, grossProfit: gp, operatingExpense: gp - oi, operatingIncome: oi,
      EBITDA: oi + da, interestExpense: debt * 0.08, pretaxIncome: ni / 0.7, taxProvision: ni / 0.7 * 0.3, netIncome: ni, basicEPS: ni / shares, dilutedEPS: ni / shares,
      totalAssets: ta, currentAssets: ta * 0.38, cashAndCashEquivalents: ta * 0.09, inventory: ta * 0.1, accountsReceivable: ta * 0.11, netPPE: ta * 0.42,
      totalLiabilitiesNetMinorityInterest: ta - eq, currentLiabilities: ta * 0.27, longTermDebt: debt * 0.8, totalDebt: debt, stockholdersEquity: eq, ordinarySharesNumber: shares,
      operatingCashFlow: ni + da * 1.1, investingCashFlow: -rev * 0.06, financingCashFlow: -ni * 0.55, capitalExpenditure: -rev * 0.055, freeCashFlow: ni + da * 1.1 - rev * 0.055, cashDividendsPaid: -ni * 0.45,
    });
  }
  const quarterly = [];
  const last = annual[annual.length - 1];
  for (let k = 7; k >= 0; k--) {
    const d = new Date(); d.setMonth(d.getMonth() - 3 * k - 1); const qd = `${d.getFullYear()}-${String(Math.floor(d.getMonth() / 3) * 3 + 3).padStart(2, '0')}-30`;
    const f = Math.pow(1 + g, -k / 4) / 4 * (1 + (r() - 0.5) * 0.08);
    const row = {}; for (const [kk, v] of Object.entries(last)) if (typeof v === 'number') row[kk] = /Assets|Liabilities|Debt|Equity|cash|inventory|Receivable|PPE|Shares/.test(kk) ? v : v * f; row.date = qd; quarterly.push(row);
  }
  const eps = last.netIncome / shares;
  return {
    demo: true,
    summary: {
      price: { regularMarketPrice: price, marketCap: mcap, longName: symbol },
      summaryDetail: { trailingPE: price / eps, forwardPE: price / (eps * (1 + g)), dividendYield: 0.025, dividendRate: price * 0.025, payoutRatio: 0.45, fiftyTwoWeekHigh: price * 1.18, fiftyTwoWeekLow: price * 0.82, beta: null, marketCap: mcap },
      defaultKeyStatistics: { priceToBook: mcap / last.stockholdersEquity, enterpriseValue: mcap + last.totalDebt - last.cashAndCashEquivalents, trailingEps: eps, forwardEps: eps * (1 + g), sharesOutstanding: shares, enterpriseToEbitda: (mcap + last.totalDebt - last.cashAndCashEquivalents) / last.EBITDA },
      financialData: { recommendationKey: 'hold', targetMeanPrice: price * 1.08, targetHighPrice: price * 1.3, targetLowPrice: price * 0.85, numberOfAnalystOpinions: 12, revenueGrowth: g, returnOnEquity: last.netIncome / last.stockholdersEquity },
      assetProfile: { sector: 'Ilustrativo', industry: 'Ilustrativo', longBusinessSummary: 'Cifras ilustrativas generadas para demostrar el módulo. No corresponden a los estados financieros reales de la emisora.' },
      earningsTrend: { trend: [{ period: '0y', growth: g, earningsEstimate: { avg: eps * (1 + g) }, revenueEstimate: { avg: last.totalRevenue * (1 + g) } }, { period: '+1y', growth: g * 0.9, earningsEstimate: { avg: eps * (1 + g) * (1 + g * 0.9) }, revenueEstimate: { avg: last.totalRevenue * (1 + g) * (1 + g * 0.9) } }] },
      recommendationTrend: { trend: [{ period: '0m', strongBuy: 3, buy: 4, hold: 4, sell: 1, strongSell: 0 }] },
      calendarEvents: { earnings: { earningsDate: [new Date(Date.now() + 40 * 864e5).toISOString()] } },
    },
    annual, quarterly,
  };
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/); if (lines.length < 3) throw new Error('El archivo no tiene filas suficientes');
  const sep = lines[0].includes(';') ? ';' : ',';
  const head = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ''));
  const ix = (names) => head.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));
  const iD = ix(['date', 'fecha']), iO = ix(['open', 'apertura']), iH = ix(['high', 'máximo', 'maximo', 'max']), iL = ix(['low', 'mínimo', 'minimo', 'min']), iC = ix(['close', 'cierre', 'price', 'último', 'ultimo']), iA = ix(['adj close', 'adj']), iV = ix(['volume', 'volumen', 'vol']);
  if (iD < 0 || iC < 0) throw new Error('Faltan columnas Date y Close');
  const num = (s) => { if (s == null) return NaN; s = s.replace(/"/g, '').trim(); if (/^-?[\d.]+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); const m = s.match(/^(-?[\d.]+)([KMB])?$/i); if (!m) return parseFloat(s); return parseFloat(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1); };
  const toISO = (s) => { s = s.replace(/"/g, '').trim(); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; const d = new Date(s); return isNaN(d) ? null : d.toISOString().slice(0, 10); };
  const rows = [];
  for (const ln of lines.slice(1)) {
    const c = ln.split(sep); const d = toISO(c[iD] || ''); const close = num(c[iC]); if (!d || !isNum(close)) continue;
    const o = iO >= 0 ? num(c[iO]) : close, h = iH >= 0 ? num(c[iH]) : close, l = iL >= 0 ? num(c[iL]) : close;
    rows.push({ d, o: isNum(o) ? o : close, h: isNum(h) ? h : close, l: isNum(l) ? l : close, c: close, ac: iA >= 0 && isNum(num(c[iA])) ? num(c[iA]) : close, v: iV >= 0 && isNum(num(c[iV])) ? num(c[iV]) : 0 });
  }
  rows.sort((a, b) => a.d.localeCompare(b.d));
  if (rows.length < 30) throw new Error('Se necesitan al menos 30 filas válidas');
  return rows;
}

// ---------- Indicadores técnicos ----------
const T = {
  sma(a, n) { const o = new Array(a.length).fill(null); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; } return o; },
  ema(a, n) { const o = new Array(a.length).fill(null), k = 2 / (n + 1); let e = null; for (let i = 0; i < a.length; i++) { e = e == null ? a[i] : a[i] * k + e * (1 - k); if (i >= n - 1) o[i] = e; } return o; },
  rsi(c, n) {
    const o = new Array(c.length).fill(null); if (c.length <= n) return o;
    let g = 0, l = 0; for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
    g /= n; l /= n; o[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    return o;
  },
  roc(c, n) { return c.map((x, i) => (i >= n ? (x / c[i - n] - 1) * 100 : null)); },
  williams(h, l, c, n) { return c.map((x, i) => { if (i < n - 1) return null; let hh = -Infinity, ll = Infinity; for (let j = i - n + 1; j <= i; j++) { hh = Math.max(hh, h[j]); ll = Math.min(ll, l[j]); } return hh === ll ? -50 : (hh - x) / (hh - ll) * -100; }); },
  stoch(h, l, c, n, dn) {
    const K = c.map((x, i) => { if (i < n - 1) return null; let hh = -Infinity, ll = Infinity; for (let j = i - n + 1; j <= i; j++) { hh = Math.max(hh, h[j]); ll = Math.min(ll, l[j]); } return hh === ll ? 50 : (x - ll) / (hh - ll) * 100; });
    const D = K.map((_, i) => { const w = K.slice(Math.max(0, i - dn + 1), i + 1); return w.length === dn && w.every((x) => x != null) ? w.reduce((s, x) => s + x, 0) / dn : null; });
    return { K, D };
  },
  atr(h, l, c, n) { const tr = c.map((x, i) => i === 0 ? h[i] - l[i] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))); return T.sma(tr, n); },
  fibo(h, l, win) {
    const n = h.length, s = Math.max(0, n - win); let hi = -Infinity, lo = Infinity, hiI = s, loI = s;
    for (let i = s; i < n; i++) { if (h[i] > hi) { hi = h[i]; hiI = i; } if (l[i] < lo) { lo = l[i]; loI = i; } }
    const up = loI < hiI, rng = hi - lo;
    const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618];
    const levels = ratios.map((rt) => ({ r: rt, price: up ? hi - rt * rng : lo + rt * rng, ext: rt > 1 }));
    return { hi, lo, hiI, loI, up, levels };
  },
};

// ---------- Pivotes y figuras chartistas ----------
function pivots(h, l, k) {
  const ph = [], pl = [];
  for (let i = k; i < h.length - k; i++) {
    let isH = true, isL = true;
    for (let j = i - k; j <= i + k; j++) { if (h[j] > h[i]) isH = false; if (l[j] < l[i]) isL = false; }
    if (isH) ph.push({ i, p: h[i] }); if (isL) pl.push({ i, p: l[i] });
  }
  return { ph, pl };
}
function supportResistance(B, k) {
  const h = B.map((b) => b.h), l = B.map((b) => b.l), c = B.map((b) => b.c), last = c[c.length - 1];
  const { ph, pl } = pivots(h, l, k);
  const atr = T.atr(h, l, c, 14).filter((x) => x != null).pop() || last * 0.02;
  const pts = [...ph.map((x) => ({ ...x, t: 'R' })), ...pl.map((x) => ({ ...x, t: 'S' }))].sort((a, b) => a.p - b.p);
  const clusters = [];
  for (const p of pts) { const cl = clusters.find((c) => Math.abs(c.p - p.p) <= atr * 0.6); if (cl) { cl.n++; cl.p = (cl.p * (cl.n - 1) + p.p) / cl.n; cl.last = Math.max(cl.last, p.i); } else clusters.push({ p: p.p, n: 1, last: p.i }); }
  const lv = clusters.filter((c) => c.n >= 2).map((c) => ({ ...c, kind: c.p > last ? 'Resistencia' : 'Soporte', dist: c.p / last - 1 }));
  const res = lv.filter((x) => x.kind === 'Resistencia').sort((a, b) => a.p - b.p).slice(0, 4);
  const sup = lv.filter((x) => x.kind === 'Soporte').sort((a, b) => b.p - a.p).slice(0, 4);
  return { res, sup, atr, ph, pl };
}
function trendInfo(B) {
  const c = B.map((b) => b.c), n = c.length;
  const P = { D: 200, W: 40, M: 12, N: Math.max(5, Math.round(200 / S.nDays)) }[S.cycle], Sc = { D: 50, W: 10, M: 4, N: Math.max(3, Math.round(50 / S.nDays)) }[S.cycle];
  const smaP = T.sma(c, Math.min(P, Math.max(5, n - 2))), smaS = T.sma(c, Math.min(Sc, Math.max(3, n - 2)));
  const slope = (a, w) => { const v = a.slice(-w).filter((x) => x != null); if (v.length < 3) return 0; return Q.linreg(v).slope / v[v.length - 1]; };
  const last = c[n - 1], lp = smaP[n - 1], ls = smaS[n - 1];
  const sp = slope(smaP, Math.min(20, n)), ss = slope(smaS, Math.min(10, n));
  const lab = (px, ma, sl) => (ma == null ? 'Sin datos' : px > ma && sl > 0.0002 ? 'Alcista' : px < ma && sl < -0.0002 ? 'Bajista' : 'Lateral');
  return { P, Sc, smaP, smaS, primary: lab(last, lp, sp), secondary: lab(last, ls, ss), sp, ss };
}
function detectFigures(B, k) {
  const h = B.map((b) => b.h), l = B.map((b) => b.l), c = B.map((b) => b.c), n = c.length, last = c[n - 1];
  const { ph, pl } = pivots(h, l, k); const figs = [];
  const near = (a, b, tol) => Math.abs(a / b - 1) <= tol;
  // Doble techo / doble piso
  if (ph.length >= 2) {
    const [a, b] = ph.slice(-2); const trough = Math.min(...l.slice(a.i, b.i + 1));
    if (near(a.p, b.p, 0.03) && b.i - a.i >= k * 2 && trough < Math.min(a.p, b.p) * 0.97) {
      const conf = last < trough; const tgt = trough - (Math.max(a.p, b.p) - trough);
      figs.push({ name: 'Doble techo', bias: 'bajista', state: conf ? 'Confirmado (rompió línea cuello)' : 'En formación', post: conf ? 'Venta' : 'Esperar / venta en ruptura', target: tgt, stop: Math.max(a.p, b.p) * 1.01, lines: [{ y: trough, label: 'Cuello' }], pts: [a, b], w: conf ? 1.5 : 0.6 });
    }
  }
  if (pl.length >= 2) {
    const [a, b] = pl.slice(-2); const peak = Math.max(...h.slice(a.i, b.i + 1));
    if (near(a.p, b.p, 0.03) && b.i - a.i >= k * 2 && peak > Math.max(a.p, b.p) * 1.03) {
      const conf = last > peak; const tgt = peak + (peak - Math.min(a.p, b.p));
      figs.push({ name: 'Doble piso', bias: 'alcista', state: conf ? 'Confirmado (rompió línea cuello)' : 'En formación', post: conf ? 'Compra' : 'Esperar / compra en ruptura', target: tgt, stop: Math.min(a.p, b.p) * 0.99, lines: [{ y: peak, label: 'Cuello' }], pts: [a, b], w: conf ? 1.5 : 0.6 });
    }
  }
  // Hombro-cabeza-hombro y su inverso
  if (ph.length >= 3) {
    const [a, b, d] = ph.slice(-3);
    if (b.p > a.p * 1.02 && b.p > d.p * 1.02 && near(a.p, d.p, 0.05)) {
      const neck = (Math.min(...l.slice(a.i, b.i + 1)) + Math.min(...l.slice(b.i, d.i + 1))) / 2, conf = last < neck;
      figs.push({ name: 'Hombro-cabeza-hombro', bias: 'bajista', state: conf ? 'Confirmado' : 'En formación', post: conf ? 'Venta' : 'Vigilar ruptura del cuello', target: neck - (b.p - neck), stop: d.p * 1.01, lines: [{ y: neck, label: 'Cuello HCH' }], pts: [a, b, d], w: conf ? 1.6 : 0.7 });
    }
  }
  if (pl.length >= 3) {
    const [a, b, d] = pl.slice(-3);
    if (b.p < a.p * 0.98 && b.p < d.p * 0.98 && near(a.p, d.p, 0.05)) {
      const neck = (Math.max(...h.slice(a.i, b.i + 1)) + Math.max(...h.slice(b.i, d.i + 1))) / 2, conf = last > neck;
      figs.push({ name: 'HCH invertido', bias: 'alcista', state: conf ? 'Confirmado' : 'En formación', post: conf ? 'Compra' : 'Vigilar ruptura del cuello', target: neck + (neck - b.p), stop: d.p * 0.99, lines: [{ y: neck, label: 'Cuello HCH inv.' }], pts: [a, b, d], w: conf ? 1.6 : 0.7 });
    }
  }
  // Triángulos y canales (pendiente de los últimos pivotes)
  const win = Math.min(n, Math.max(60, k * 20));
  const rh = ph.filter((p) => p.i >= n - win).slice(-4), rl = pl.filter((p) => p.i >= n - win).slice(-4);
  if (rh.length >= 2 && rl.length >= 2) {
    const fit = (pts) => { const xs = pts.map((p) => p.i), ys = pts.map((p) => p.p), mx = Q.mean(xs), my = Q.mean(ys); let a = 0, b = 0; xs.forEach((x, i) => { a += (x - mx) * (ys[i] - my); b += (x - mx) ** 2; }); const s = a / (b || 1); return { s, i0: my - s * mx }; };
    const fh = fit(rh), fl = fit(rl), nh = fh.s / last, nl = fl.s / last, th = 0.0006;
    const flat = (x) => Math.abs(x) < th;
    let fig = null;
    if (flat(nh) && nl > th) fig = { name: 'Triángulo ascendente', bias: 'alcista', post: 'Compra en ruptura de resistencia' };
    else if (nh < -th && flat(nl)) fig = { name: 'Triángulo descendente', bias: 'bajista', post: 'Venta en ruptura de soporte' };
    else if (nh < -th && nl > th) fig = { name: 'Triángulo simétrico', bias: 'neutral', post: 'Esperar dirección de ruptura (straddle)' };
    else if (nh > th && nl > th) fig = { name: 'Canal alcista', bias: 'alcista', post: 'Compra cerca del soporte del canal' };
    else if (nh < -th && nl < -th) fig = { name: 'Canal bajista', bias: 'bajista', post: 'Venta cerca de la resistencia del canal' };
    else if (flat(nh) && flat(nl)) fig = { name: 'Rango lateral', bias: 'neutral', post: 'Vender volatilidad (strangle corto, mariposa)' };
    else if (nh > th && nl < -th) fig = { name: 'Triángulo expansivo (megáfono)', bias: 'neutral', post: 'Comprar volatilidad (straddle o strangle largo)' };
    else if (nh > th && flat(nl)) fig = { name: 'Máximos crecientes sobre piso plano', bias: 'alcista', post: 'Compra con stop bajo el piso' };
    else if (flat(nh) && nl < -th) fig = { name: 'Mínimos decrecientes bajo techo plano', bias: 'bajista', post: 'Venta con stop sobre el techo' };
    if (fig) {
      const upper = fh.i0 + fh.s * (n - 1), lower = fl.i0 + fl.s * (n - 1);
      figs.push({ ...fig, state: last > upper ? 'Ruptura al alza' : last < lower ? 'Ruptura a la baja' : 'Dentro de la figura', target: fig.bias === 'bajista' ? lower - (upper - lower) : upper + (upper - lower), stop: fig.bias === 'bajista' ? upper : lower, trend: { fh, fl, from: Math.min(rh[0].i, rl[0].i) }, w: 0.8 });
    }
  }
  // Rupturas de máximos/mínimos de 20 barras
  if (n > 22) {
    const hh = Math.max(...h.slice(n - 21, n - 1)), ll = Math.min(...l.slice(n - 21, n - 1));
    if (last > hh) figs.push({ name: 'Ruptura de máximo de 20 barras', bias: 'alcista', state: 'Activa', post: 'Compra', target: last * 1.05, stop: ll, w: 1 });
    if (last < ll) figs.push({ name: 'Ruptura de mínimo de 20 barras', bias: 'bajista', state: 'Activa', post: 'Venta', target: last * 0.95, stop: hh, w: 1 });
  }
  // Cruces de medias
  const tr = trendInfo(B);
  for (let i = Math.max(1, n - 10); i < n; i++) {
    const a0 = tr.smaS[i - 1], b0 = tr.smaP[i - 1], a1 = tr.smaS[i], b1 = tr.smaP[i];
    if ([a0, b0, a1, b1].some((x) => x == null)) continue;
    if (a0 < b0 && a1 >= b1) figs.push({ name: `Cruce dorado (MA${tr.Sc}/MA${tr.P})`, bias: 'alcista', state: `Hace ${n - 1 - i} barras`, post: 'Compra', w: 1.2 });
    if (a0 > b0 && a1 <= b1) figs.push({ name: `Cruce de la muerte (MA${tr.Sc}/MA${tr.P})`, bias: 'bajista', state: `Hace ${n - 1 - i} barras`, post: 'Venta', w: 1.2 });
  }
  if (!figs.length) {
    const t = tr.primary, s2 = tr.secondary, ma = tr.smaP[n - 1];
    if (t !== 'Sin datos') figs.push({ name: `Tendencia ${t.toLowerCase()} sin figura definida`, bias: t === 'Alcista' ? 'alcista' : t === 'Bajista' ? 'bajista' : 'neutral', state: `Precio ${last > ma ? 'sobre' : 'bajo'} MM${tr.P}; secundaria ${s2.toLowerCase()}`, post: t === 'Alcista' ? 'Compra en retrocesos al soporte' : t === 'Bajista' ? 'Venta en rebotes a la resistencia' : 'Estrategias de rango', w: 0.4 });
  }
  return { figs, ph, pl };
}

// ---------- Lectura técnica compuesta ----------
function technicalRead(B) {
  const c = B.map((b) => b.c), h = B.map((b) => b.h), l = B.map((b) => b.l);
  const P = S.tp || { roc: 12, will: 14, k: 14, d: 3, fib: 120 };
  const r9 = T.rsi(c, 9), r14 = T.rsi(c, 14), r25 = T.rsi(c, 25), roc = T.roc(c, P.roc), wil = T.williams(h, l, c, P.will), st = T.stoch(h, l, c, P.k, P.d);
  const L = (a) => a[a.length - 1];
  const sig = []; let score = 0;
  const add = (name, val, txt, s) => { sig.push({ name, val, txt, s }); score += s; };
  const rs = L(r14);
  add('RSI 14', rs, rs < 30 ? 'Sobreventa' : rs > 70 ? 'Sobrecompra' : rs > 50 ? 'Momento positivo' : 'Momento negativo', rs < 30 ? 1 : rs > 70 ? -1 : rs > 50 ? 0.3 : -0.3);
  const r9v = L(r9), r25v = L(r25);
  add('RSI 9 vs 25', r9v, r9v > r25v ? 'Corto plazo más fuerte' : 'Corto plazo más débil', r9v > r25v ? 0.4 : -0.4);
  const k = L(st.K), d = L(st.D);
  add('Estocástico', k, k < 20 ? (k > d ? 'Sobreventa con giro' : 'Sobreventa') : k > 80 ? (k < d ? 'Sobrecompra con giro' : 'Sobrecompra') : k > d ? '%K sobre %D' : '%K bajo %D', k < 20 ? (k > d ? 1 : 0.5) : k > 80 ? (k < d ? -1 : -0.5) : k > d ? 0.3 : -0.3);
  const w = L(wil);
  add('Williams %R', w, w < -80 ? 'Sobreventa' : w > -20 ? 'Sobrecompra' : 'Neutral', w < -80 ? 0.8 : w > -20 ? -0.8 : 0);
  const ro = L(roc);
  add('ROC', ro, ro > 0 ? 'Impulso alcista' : 'Impulso bajista', ro > 0 ? 0.5 : -0.5);
  const tr = trendInfo(B);
  const tv = (x) => (x === 'Alcista' ? 1 : x === 'Bajista' ? -1 : 0);
  add('Tendencia primaria', null, tr.primary, tv(tr.primary) * 1.5);
  add('Tendencia secundaria', null, tr.secondary, tv(tr.secondary));
  const fg = detectFigures(B, 5).figs;
  for (const f of fg) add(f.name, null, f.state, (f.bias === 'alcista' ? 1 : f.bias === 'bajista' ? -1 : 0) * (f.w || 0.5));
  const view = score >= 1.75 ? 'Alcista' : score <= -1.75 ? 'Bajista' : 'Lateral';
  return { r9, r14, r25, roc, wil, st, sig, score, view, tr, figs: fg };
}
