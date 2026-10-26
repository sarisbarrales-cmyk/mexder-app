/* ===================== UI 1: gráficas, parámetros, análisis ===================== */
const CH = {};
const cssv = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const COL = () => ({ ink: cssv('--ink'), muted: cssv('--muted'), grid: cssv('--grid'), line: cssv('--line'), accent: cssv('--accent'), ochre: cssv('--ochre'), up: cssv('--up'), down: cssv('--down'), s3: cssv('--s3'), s4: cssv('--s4'), surface: cssv('--surface') });
const alpha = (c, a) => { if (c.startsWith('#')) { const n = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1, 7); const i = parseInt(n, 16); return `rgba(${(i >> 16) & 255},${(i >> 8) & 255},${i & 255},${a})`; } return c; };

const hlinePlugin = {
  id: 'hlines',
  afterDatasetsDraw(ch, _a, opts) {
    const lines = opts && opts.lines; if (!lines || !lines.length) return;
    const { ctx, chartArea: a, scales } = ch; ctx.save();
    for (const L of lines) {
      ctx.strokeStyle = L.color; ctx.fillStyle = L.color; ctx.lineWidth = L.w || 1; ctx.setLineDash(L.dash || [4, 4]);
      ctx.font = '600 10.5px "IBM Plex Mono", monospace';
      if (L.y != null && scales.y) {
        const py = scales.y.getPixelForValue(L.y); if (py < a.top - 1 || py > a.bottom + 1) continue;
        ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
        if (L.label) { ctx.setLineDash([]); ctx.textAlign = 'right'; const tw = ctx.measureText(L.label).width; ctx.save(); ctx.fillStyle = L.bg || 'transparent'; ctx.restore(); ctx.fillText(L.label, a.right - 4, py - 3); }
      } else if (L.x != null && scales.x) {
        const px = scales.x.getPixelForValue(L.x); if (px < a.left || px > a.right) continue;
        ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
        if (L.label) { ctx.setLineDash([]); ctx.textAlign = 'left'; ctx.fillText(L.label, px + 4, a.top + 11); }
      }
    }
    ctx.restore();
  },
};
function setupChartDefaults() {
  if (!window.Chart) return;
  Chart.register(hlinePlugin);
  Chart.defaults.font.family = '"Archivo", "Helvetica Neue", Arial, sans-serif';
  Chart.defaults.font.size = 11.5;
  Chart.defaults.animation = false;
  Chart.defaults.maintainAspectRatio = false;
}
function axes(c, o = {}) {
  const tick = { color: c.muted, font: { family: '"IBM Plex Mono", monospace', size: 10.5 } };
  return {
    x: Object.assign({ grid: { color: c.grid, drawTicks: false }, border: { color: c.line }, ticks: { ...tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, o.x || {}),
    y: Object.assign({ position: 'right', grid: { color: c.grid, drawTicks: false }, border: { display: false }, ticks: { ...tick, callback: (v) => fmt(v, Math.abs(v) < 10 ? 2 : 0) } }, o.y || {}),
  };
}
function baseOpts(c, extra = {}) {
  return Object.assign({
    responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { color: c.muted, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded' } }, tooltip: { backgroundColor: c.ink, titleColor: c.surface, bodyColor: c.surface, titleFont: { family: '"IBM Plex Mono", monospace' }, bodyFont: { family: '"IBM Plex Mono", monospace' }, callbacks: { label: (it) => `${it.dataset.label}: ${fmt(it.parsed.y, 2)}` } } },
  }, extra);
}
function mkChart(id, cfg) {
  if (!window.Chart) return null;
  if (CH[id]) { CH[id].destroy(); delete CH[id]; }
  const el = document.getElementById(id); if (!el) return null;
  CH[id] = new Chart(el, cfg); return CH[id];
}
function lineDS(label, data, color, extra = {}) { return Object.assign({ type: 'line', label, data, borderColor: color, backgroundColor: color, borderWidth: 1.6, pointRadius: 0, tension: 0, spanGaps: true }, extra); }

function cfgCandles(B, c, overlays = [], lines = [], opts = {}) {
  const lab = B.map((b) => b.d);
  const up = B.map((b) => b.c >= b.o);
  const ds = [];
  if (opts.line) ds.push(lineDS('Cierre', B.map((b) => b.c), c.accent, { order: 1, fill: { target: 'origin', above: alpha(c.accent, 0.06) } }));
  else {
    ds.push({ type: 'bar', label: 'Rango', data: B.map((b) => [b.l, b.h]), backgroundColor: up.map((u) => (u ? c.up : c.down)), barThickness: 1, grouped: false, order: 3 });
    ds.push({ type: 'bar', label: 'Cuerpo', data: B.map((b) => { const lo = Math.min(b.o, b.c), hi = Math.max(b.o, b.c); return [lo, hi === lo ? hi + lo * 0.0004 : hi]; }), backgroundColor: up.map((u) => (u ? c.up : c.down)), barPercentage: 0.75, categoryPercentage: 0.9, grouped: false, order: 2 });
  }
  ds.push(...overlays);
  const lo = Math.min(...B.map((b) => b.l)), hi = Math.max(...B.map((b) => b.h)), pad = (hi - lo) * 0.06;
  const ly = lines.map((L) => L.y).filter((v) => isNum(v) && v > lo * 0.8 && v < hi * 1.25);
  const o = baseOpts(c, { scales: axes(c, { y: { beginAtZero: false, min: Math.min(lo, ...ly) - pad, max: Math.max(hi, ...ly) + pad } }) });
  o.plugins.hlines = { lines };
  o.plugins.legend.labels.filter = (it) => !['Rango', 'Cuerpo'].includes(it.text);
  o.plugins.tooltip.callbacks.label = (it) => {
    if (it.dataset.label === 'Rango') return null;
    if (it.dataset.label === 'Cuerpo') { const b = B[it.dataIndex]; return `A ${fmt(b.o)}  M ${fmt(b.h)}  m ${fmt(b.l)}  C ${fmt(b.c)}`; }
    return isNum(it.parsed.y) ? `${it.dataset.label}: ${fmt(it.parsed.y)}` : null;
  };
  return { type: 'bar', data: { labels: lab, datasets: ds }, options: o };
}

// ---------- Parámetros compartidos ----------
function tickOf(px) { return px < 20 ? 0.5 : px < 100 ? 1 : px < 500 ? 5 : 10; }
const roundTick = (x, px) => { const t = tickOf(px); return Math.round(x / t) * t; };
const MXMONTH = ['EN', 'FB', 'MR', 'AB', 'MY', 'JN', 'JL', 'AG', 'SP', 'OC', 'NV', 'DC'];
function mexderSeries() {
  const out = [], now = new Date();
  for (let y = now.getFullYear(); out.length < 8; y++) for (const m of [2, 5, 8, 11]) {
    const d = new Date(y, m, 1); const add = (5 - d.getDay() + 7) % 7; d.setDate(1 + add + 14);
    const days = Math.round((d - now) / 864e5); if (days > 3 && out.length < 8) out.push({ code: MXMONTH[m] + String(y).slice(2), date: d.toISOString().slice(0, 10), days });
  }
  return out;
}
function lastClose() { return S.all.length ? S.all[S.all.length - 1].c : NaN; }
function P() {
  const spot = parseFloat($('#p-spot').value) || lastClose();
  const r = (parseFloat($('#p-r').value) || 0) / 100, q = (parseFloat($('#p-q').value) || 0) / 100;
  const v = Math.max((parseFloat($('#p-vol').value) || 25) / 100, 0.01);
  const tv = $('#p-term').value;
  let days = tv === 'custom' ? parseInt($('#p-days').value) || 30 : tv === 'mx' ? (mexderSeries().find((s) => s.code === $('#p-term-mx').value) || mexderSeries()[0]).days : parseInt(tv);
  days = Math.max(1, days);
  const size = Math.max(1, parseInt($('#p-size').value) || 100), n = Math.max(1, parseInt($('#p-n').value) || 1);
  const cap = parseFloat($('#p-cap').value) || 500000, prof = $('#p-prof').value;
  const T = days / 365, F = spot * Math.exp((r - q) * T);
  const termLabel = tv === 'mx' ? `Serie ${$('#p-term-mx').value}` : $('#p-term').selectedOptions[0].textContent.replace(/\s*\(.*\)/, '') + (tv === 'custom' ? ` (${days} d)` : '');
  return { spot, r, q, v, days, T, size, n, mult: size, cap, prof, F, termLabel };
}
const PROF = { cons: 'Conservador', mod: 'Moderado', agr: 'Agresivo' };

function volEstimates() {
  const d = S.all, last = d.slice(-252), c = last.map((x) => x.c);
  const wk = resample(S.all.slice(-504), 'W'), mo = resample(S.all.slice(-1260), 'M');
  return {
    hist: Q.volHist(c, 252), ewma: Q.volEWMA(S.all.slice(-504).map((x) => x.c), 252), park: Q.volParkinson(last.map((x) => x.h), last.map((x) => x.l), 252),
    histW: wk.length > 10 ? Q.volHist(wk.map((x) => x.c), 52) : NaN, histM: mo.length > 8 ? Q.volHist(mo.map((x) => x.c), 12) : NaN,
  };
}
function divYield() {
  const px = lastClose(); const cut = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const sum = S.divs.filter((x) => x.d >= cut).reduce((s, x) => s + x.amount, 0);
  if (sum > 0 && px) return { q: sum / px, src: 'dividendos pagados 12 m' };
  const y = S.fund && S.fund.summary && S.fund.summary.summaryDetail && (S.fund.summary.summaryDetail.dividendYield ?? S.fund.summary.summaryDetail.trailingAnnualDividendYield);
  return isNum(y) ? { q: y, src: 'rendimiento reportado' } : { q: 0, src: 'sin dividendos' };
}
function calibrate(force) {
  const px = lastClose();
  $('#p-spot').value = isNum(px) ? px.toFixed(2) : '';
  $('#p-spot-h').textContent = S.all.length ? `cierre ${S.all[S.all.length - 1].d}` : '';
  const dy = divYield(); $('#p-q').value = (dy.q * 100).toFixed(2); $('#p-q-h').textContent = dy.src;
  recalcVol(force);
  const K = roundTick(px, px);
  for (const id of ['o-K', 'oo-K']) $('#' + id).value = K;
  $('#of-px').value = '';
}

function recalcVol(force) {
  const m = $('#p-volm').value;
  if (m !== 'iv' || force) { const ve = volEstimates(); const v = ve[m === 'iv' ? 'ewma' : m]; if (isNum(v)) $('#p-vol').value = (v * 100).toFixed(1); }
  $('#p-vol-h').textContent = { hist: 'histórica 1 año', ewma: 'EWMA diaria', park: 'Parkinson 1 año', iv: 'implícita / manual' }[m];
}
// ---------- Barra superior ----------
function renderQuote() {
  const a = S.all; if (!a.length) return;
  const l = a[a.length - 1], p = a[a.length - 2] || l, ch = l.c / p.c - 1;
  $('#quote').innerHTML = `<span class="muted small">${esc(S.name || S.symbol)}</span><span class="px">$${fmt(l.c)}</span><span class="num small ${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '+' : ''}${pct(ch)}</span>`;
  const chip = $('#chip-src');
  const src = S.src === 'csv' ? 'CSV' : S.live ? 'En vivo' : 'Demostración';
  chip.textContent = src; chip.className = 'chip ' + (S.live || S.src === 'csv' ? 'live' : 'demo');
  const ban = $('#demo-banner');
  ban.hidden = S.live && !S.fund?.demo;
  if (!ban.hidden) $('#demo-text').textContent = S.src === 'csv'
    ? 'Precios del CSV que subiste. El IPC para las betas es simulado y los estados financieros son ilustrativos.'
    : S.live ? 'Los precios son reales, pero no se pudieron obtener los estados financieros: el módulo financiero muestra cifras ilustrativas.'
      : 'No hay conexión al servicio de datos, así que los precios son simulados y los estados financieros son ilustrativos. Al desplegar en Vercel se cargan datos reales de Yahoo Finance. También puedes subir un CSV de precios en Data histórica.';
}
function stat(l, v, s = '', cl = '') { return `<div class="stat"><div class="l">${l}</div><div class="v ${cl}">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`; }
function table(el, head, rows, opts = {}) {
  const h = `<thead><tr>${head.map((x) => `<th>${x}</th>`).join('')}</tr></thead>`;
  const b = rows.map((r) => `<tr class="${r._cls || ''}">${r.map((x, i) => { if (x && typeof x === 'object') return `<td class="${x.c || ''}">${x.v}</td>`; return `<td class="${i === 0 && !opts.numFirst ? 't' : ''}">${x}</td>`; }).join('')}</tr>`).join('');
  (typeof el === 'string' ? $(el) : el).innerHTML = h + `<tbody>${b}</tbody>`;
}

// ---------- 01 Data histórica ----------
function renderHist() {
  const B = bars(), c = COL(); if (!B.length) return;
  const f = B[0], l = B[B.length - 1];
  const hi = Math.max(...B.map((b) => b.h)), lo = Math.min(...B.map((b) => b.l));
  const vavg = Q.mean(B.map((b) => b.v));
  $('#h-stats').innerHTML = stat('Último cierre', '$' + fmt(l.c), l.d) + stat('Variación del período', pct(l.c / f.c - 1), `desde ${f.d}`, l.c >= f.c ? 'up' : 'down')
    + stat('Máximo', '$' + fmt(hi)) + stat('Mínimo', '$' + fmt(lo)) + stat('Volumen promedio', big(vavg), 'por barra') + stat('Barras', B.length, cycleName());
  $('#h-sub').textContent = `${cycleName()} · ${f.d} a ${l.d}`;
  const line = $('#h-ctype button[aria-pressed="true"]').dataset.v === 'line';
  const cl = B.map((b) => b.c);
  const ov = [lineDS('MM 20', T.sma(cl, 20), c.ochre, { borderWidth: 1.2 }), lineDS('MM 50', T.sma(cl, 50), c.s3, { borderWidth: 1.2 })];
  mkChart('c-hist', cfgCandles(B, c, ov, [], { line }));
  const vo = baseOpts(c, { scales: axes(c, { y: { ticks: { color: c.muted, callback: (v) => big(v), font: { family: '"IBM Plex Mono", monospace', size: 10 } } }, x: { display: false } }) });
  vo.plugins.legend.display = false; vo.plugins.tooltip.callbacks.label = (it) => 'Volumen: ' + big(it.parsed.y);
  mkChart('c-vol', { type: 'bar', data: { labels: B.map((b) => b.d), datasets: [{ label: 'Volumen', data: B.map((b) => b.v), backgroundColor: B.map((b) => alpha(b.c >= b.o ? c.up : c.down, 0.55)) }] }, options: vo });
  const rows = [...B].reverse().slice(0, 1500).map((b, i, arr) => { const prev = arr[i + 1]; const ch = prev ? b.c / prev.c - 1 : null; return [b.d, fmt(b.o), fmt(b.h), fmt(b.l), fmt(b.c), { v: ch == null ? '—' : pct(ch), c: cls(ch) }, big(b.v)]; });
  table('#t-hist', ['Fecha', 'Apertura', 'Máximo', 'Mínimo', 'Cierre', 'Var.', 'Volumen'], rows);
  $('#h-count').textContent = `${B.length} barras`;
}

// ---------- 02 Análisis técnico ----------
function readTP() { S.tp = { roc: +$('#t-roc').value || 12, will: +$('#t-will').value || 14, k: +$('#t-stk').value || 14, d: +$('#t-std').value || 3, fib: +$('#t-fib').value || 120 }; }
function oscOpts(c, min, max, lines) { const o = baseOpts(c, { scales: axes(c, { y: { min, max, ticks: { color: c.muted, font: { family: '"IBM Plex Mono", monospace', size: 10 } } } }) }); o.plugins.hlines = { lines }; return o; }
function cfgFib(B, fb, c) {
  const lines = fb.levels.map((L) => ({ y: L.price, label: `${(L.r * 100).toFixed(1)}%  ${fmt(L.price)}`, color: L.ext ? c.s3 : L.r === 0.618 || L.r === 0.382 ? c.ochre : c.muted, dash: L.ext ? [2, 4] : [5, 4] }));
  return cfgCandles(B, c, [lineDS('MM 20', T.sma(B.map((b) => b.c), 20), c.accent, { borderWidth: 1.2 })], lines);
}
function cfgRSI(B, tr, c) { return { type: 'line', data: { labels: B.map((b) => b.d), datasets: [lineDS('RSI 9', tr.r9, c.ochre, { borderWidth: 1.2 }), lineDS('RSI 14', tr.r14, c.accent), lineDS('RSI 25', tr.r25, c.s3, { borderWidth: 1.2 })] }, options: oscOpts(c, 0, 100, [{ y: 70, color: c.down, label: '70' }, { y: 30, color: c.up, label: '30' }]) }; }
function renderTec() {
  readTP();
  const all = bars(); if (all.length < 30) return;
  const c = COL(), tr = technicalRead(all);
  const view = Math.min(all.length, Math.max(S.tp.fib + 20, 160));
  const B = all.slice(-view), off = all.length - view, cut = (a) => a.slice(off);
  const L = (a) => a[a.length - 1];
  const st = (x, lo, hi) => (x < lo ? ['Sobreventa', 'up'] : x > hi ? ['Sobrecompra', 'down'] : ['Neutral', '']);
  const last = L(all).c, prev = all[all.length - 2].c;
  const tiles = [
    stat('Precio spot', '$' + fmt(last), `${pct(last / prev - 1)} vs barra previa`, last >= prev ? 'up' : 'down'),
    stat(`ROC ${S.tp.roc}`, fmt(L(tr.roc)) + '%', L(tr.roc) > 0 ? 'impulso positivo' : 'impulso negativo', L(tr.roc) > 0 ? 'up' : 'down'),
    stat(`Williams %R ${S.tp.will}`, fmt(L(tr.wil), 1), st(L(tr.wil), -80, -20)[0], st(L(tr.wil), -80, -20)[1]),
    stat(`Estocástico ${S.tp.k},${S.tp.d}`, `${fmt(L(tr.st.K), 1)} / ${fmt(L(tr.st.D), 1)}`, st(L(tr.st.K), 20, 80)[0], st(L(tr.st.K), 20, 80)[1]),
    stat('RSI 9', fmt(L(tr.r9), 1), st(L(tr.r9), 30, 70)[0], st(L(tr.r9), 30, 70)[1]),
    stat('RSI 14', fmt(L(tr.r14), 1), st(L(tr.r14), 30, 70)[0], st(L(tr.r14), 30, 70)[1]),
    stat('RSI 25', fmt(L(tr.r25), 1), st(L(tr.r25), 30, 70)[0], st(L(tr.r25), 30, 70)[1]),
  ];
  $('#t-stats').innerHTML = tiles.join('');
  const fb = T.fibo(all.map((b) => b.h), all.map((b) => b.l), S.tp.fib);
  $('#t-fibsub').textContent = `${fb.up ? 'tramo alcista' : 'tramo bajista'} de ${fmt(fb.lo)} a ${fmt(fb.hi)} · últimas ${Math.min(S.tp.fib, all.length)} barras`;
  mkChart('c-fib', cfgFib(B, fb, c));
  const Bc = { r9: cut(tr.r9), r14: cut(tr.r14), r25: cut(tr.r25) };
  mkChart('c-rsi', cfgRSI(B, Bc, c));
  mkChart('c-stoch', { type: 'line', data: { labels: B.map((b) => b.d), datasets: [lineDS('%K', cut(tr.st.K), c.accent), lineDS('%D', cut(tr.st.D), c.ochre, { borderDash: [4, 3] })] }, options: oscOpts(c, 0, 100, [{ y: 80, color: c.down, label: '80' }, { y: 20, color: c.up, label: '20' }]) });
  mkChart('c-will', { type: 'line', data: { labels: B.map((b) => b.d), datasets: [lineDS('%R', cut(tr.wil), c.s3)] }, options: oscOpts(c, -100, 0, [{ y: -20, color: c.down, label: '−20' }, { y: -80, color: c.up, label: '−80' }]) });
  mkChart('c-roc', { type: 'line', data: { labels: B.map((b) => b.d), datasets: [lineDS('ROC %', cut(tr.roc), c.s4, { fill: { target: { value: 0 }, above: alpha(c.up, 0.12), below: alpha(c.down, 0.12) } })] }, options: oscOpts(c, undefined, undefined, [{ y: 0, color: c.muted }]) });
  table('#t-fibt', ['Nivel', 'Precio', 'Distancia'], fb.levels.map((L) => { const d = L.price / last - 1; return [`${(L.r * 100).toFixed(1)}%${L.ext ? ' (ext.)' : ''}`, fmt(L.price), { v: pct(d), c: cls(d) }]; }));
  const chip = $('#t-view'); chip.textContent = `${tr.view} · puntaje ${fmt(tr.score, 1)}`; chip.className = 'chip ' + (tr.view === 'Alcista' ? 'bull' : tr.view === 'Bajista' ? 'bear' : 'flat');
  $('#t-signals').innerHTML = tr.sig.map((s) => `<div class="sigrow"><span>${esc(s.name)}</span><span class="muted small">${s.val != null ? fmt(s.val, 1) : ''}</span><span class="chip ${s.s > 0.05 ? 'bull' : s.s < -0.05 ? 'bear' : 'flat'}">${esc(s.txt)}</span></div>`).join('');
}

// ---------- 03 Análisis financiero ----------
const yr = (d) => d.slice(0, 4);
const qlab = (d) => `${Math.ceil(+d.slice(5, 7) / 3)}T${d.slice(2, 4)}`;
function fin() { return S.fund || { summary: {}, annual: [], quarterly: [] }; }
function sv(path) { let o = fin().summary; for (const k of path.split('.')) { if (o == null) return null; o = o[k]; } return o && typeof o === 'object' && 'raw' in o ? o.raw : o; }
function stmtTable(rows, defs, labF) {
  const cols = rows.map((r) => labF(r.date));
  const body = defs.map(([lab, key, kind]) => [lab, ...rows.map((r) => { const v = typeof key === 'function' ? key(r) : r[key]; return kind === 'eps' ? fmt(v, 2) : kind === 'pct' ? pct(v, 1) : kind === 'x' ? (isNum(v) ? fmt(v, 2) + '×' : '—') : isNum(v) ? fmt(v / 1e6, 0) : '—'; })]);
  return { head: ['Concepto' + (defs.some((d) => !d[2]) ? ' (millones)' : ''), ...cols], body };
}
const DEF_ER = [['Ingresos totales', 'totalRevenue'], ['Costo de ventas', 'costOfRevenue'], ['Utilidad bruta', 'grossProfit'], ['Gastos de operación', 'operatingExpense'], ['Utilidad de operación', 'operatingIncome'], ['EBITDA', 'EBITDA'], ['Gasto por intereses', 'interestExpense'], ['Utilidad antes de impuestos', 'pretaxIncome'], ['Impuestos', 'taxProvision'], ['Utilidad neta', 'netIncome'], ['UPA básica', 'basicEPS', 'eps'], ['UPA diluida', 'dilutedEPS', 'eps']];
const DEF_BAL = [['Activo total', 'totalAssets'], ['Activo circulante', 'currentAssets'], ['Efectivo y equivalentes', 'cashAndCashEquivalents'], ['Cuentas por cobrar', 'accountsReceivable'], ['Inventarios', 'inventory'], ['Propiedades, planta y equipo', 'netPPE'], ['Pasivo total', 'totalLiabilitiesNetMinorityInterest'], ['Pasivo circulante', 'currentLiabilities'], ['Deuda de largo plazo', 'longTermDebt'], ['Deuda total', 'totalDebt'], ['Capital contable', 'stockholdersEquity'], ['Acciones en circulación', 'ordinarySharesNumber']];
const DEF_FLU = [['Flujo de operación', 'operatingCashFlow'], ['Flujo de inversión', 'investingCashFlow'], ['Flujo de financiamiento', 'financingCashFlow'], ['Inversión en capital (CapEx)', 'capitalExpenditure'], ['Flujo libre de efectivo', 'freeCashFlow'], ['Dividendos pagados', 'cashDividendsPaid']];
const DEF_RAT = [
  ['Margen bruto', (r) => r.grossProfit / r.totalRevenue, 'pct'], ['Margen de operación', (r) => r.operatingIncome / r.totalRevenue, 'pct'], ['Margen EBITDA', (r) => r.EBITDA / r.totalRevenue, 'pct'], ['Margen neto', (r) => r.netIncome / r.totalRevenue, 'pct'],
  ['ROE', (r) => r.netIncome / r.stockholdersEquity, 'pct'], ['ROA', (r) => r.netIncome / r.totalAssets, 'pct'], ['Rotación de activos', (r) => r.totalRevenue / r.totalAssets, 'x'],
  ['Liquidez corriente', (r) => r.currentAssets / r.currentLiabilities, 'x'], ['Prueba ácida', (r) => (r.currentAssets - (r.inventory || 0)) / r.currentLiabilities, 'x'],
  ['Deuda / capital', (r) => r.totalDebt / r.stockholdersEquity, 'x'], ['Deuda neta / EBITDA', (r) => (r.totalDebt - (r.cashAndCashEquivalents || 0)) / r.EBITDA, 'x'], ['Cobertura de intereses', (r) => r.operatingIncome / r.interestExpense, 'x'],
  ['Pago de dividendos', (r) => -(r.cashDividendsPaid || 0) / r.netIncome, 'pct'], ['Conversión a flujo libre', (r) => r.freeCashFlow / r.netIncome, 'pct'],
];
function finAnnual() { return [...fin().annual].filter((r) => r.totalRevenue || r.totalAssets || r.operatingCashFlow).sort((a, b) => a.date.localeCompare(b.date)).slice(-5); }
function finQuarterly() { return [...fin().quarterly].filter((r) => r.totalRevenue || r.totalAssets).sort((a, b) => a.date.localeCompare(b.date)).slice(-8); }
function finCard(title, inner) { return `<div class="card"><h3>${title}</h3>${inner}</div>`; }
function tblHTML(head, body) { const d = document.createElement('table'); table(d, head, body); return `<div class="tbl-wrap">${d.outerHTML}</div>`; }
function renderFin() {
  const tab = $('#fin-tabs [aria-selected="true"]').dataset.t, el = $('#fin-body'), c = COL();
  const A = finAnnual(), Qr = finQuarterly(), px = lastClose();
  $('#fin-src').textContent = fin().demo ? 'Cifras ilustrativas (modo demostración): no son los estados financieros reales de la emisora.' : `Fuente: Yahoo Finance · ${S.name}. Cifras en la moneda de reporte de la emisora.`;
  const none = '<p class="muted">No hay datos para esta sección.</p>';
  if (tab === 'res') {
    const tiles = [
      stat('Valor de capitalización', big(sv('price.marketCap') ?? sv('summaryDetail.marketCap'))), stat('P/U (12 m)', fmt(sv('summaryDetail.trailingPE'), 1) + '×'), stat('P/U estimado', fmt(sv('summaryDetail.forwardPE'), 1) + '×'),
      stat('Precio / valor en libros', fmt(sv('defaultKeyStatistics.priceToBook'), 2) + '×'), stat('VE / EBITDA', fmt(sv('defaultKeyStatistics.enterpriseToEbitda'), 1) + '×'), stat('UPA 12 m', '$' + fmt(sv('defaultKeyStatistics.trailingEps'))),
      stat('Rend. por dividendo', pct(sv('summaryDetail.dividendYield'))), stat('Rango 52 semanas', `${fmt(sv('summaryDetail.fiftyTwoWeekLow'))} – ${fmt(sv('summaryDetail.fiftyTwoWeekHigh'))}`),
      stat('Recomendación consenso', esc(({ strong_buy: 'Compra fuerte', buy: 'Compra', hold: 'Mantener', underperform: 'Bajo rendimiento', sell: 'Venta' })[sv('financialData.recommendationKey')] || '—'), sv('financialData.numberOfAnalystOpinions') ? `${sv('financialData.numberOfAnalystOpinions')} analistas` : ''),
      stat('Precio objetivo medio', '$' + fmt(sv('financialData.targetMeanPrice')), isNum(sv('financialData.targetMeanPrice')) ? `${pct(sv('financialData.targetMeanPrice') / px - 1)} potencial` : ''),
    ];
    el.innerHTML = `<div class="stats">${tiles.join('')}</div>
      <div class="grid g2"><div class="card"><h3>Ingresos y utilidad neta <span class="sub">millones</span></h3><div class="chart"><canvas id="c-fin1"></canvas></div></div>
      <div class="card"><h3>Márgenes</h3><div class="chart"><canvas id="c-fin2"></canvas></div></div></div>
      <div class="card"><h3>Perfil</h3><p class="small muted">${esc(sv('assetProfile.sector') || '')}${sv('assetProfile.industry') ? ' · ' + esc(sv('assetProfile.industry')) : ''}</p><p class="desc" style="margin-top:6px">${esc((sv('assetProfile.longBusinessSummary') || 'Sin descripción disponible.').slice(0, 900))}</p></div>`;
    if (A.length) {
      const lab = A.map((r) => yr(r.date));
      const o1 = baseOpts(c, { scales: axes(c, { y: { ticks: { color: c.muted, callback: (v) => fmt(v, 0) } } }) });
      mkChart('c-fin1', { type: 'bar', data: { labels: lab, datasets: [{ label: 'Ingresos', data: A.map((r) => r.totalRevenue / 1e6), backgroundColor: c.accent }, { label: 'Utilidad neta', data: A.map((r) => r.netIncome / 1e6), backgroundColor: c.ochre }] }, options: o1 });
      const o2 = baseOpts(c, { scales: axes(c, { y: { ticks: { color: c.muted, callback: (v) => v + '%' } } }) });
      mkChart('c-fin2', { type: 'line', data: { labels: lab, datasets: [lineDS('Bruto', A.map((r) => r.grossProfit / r.totalRevenue * 100), c.accent, { pointRadius: 3 }), lineDS('Operación', A.map((r) => r.operatingIncome / r.totalRevenue * 100), c.s3, { pointRadius: 3 }), lineDS('Neto', A.map((r) => r.netIncome / r.totalRevenue * 100), c.ochre, { pointRadius: 3 })] }, options: o2 });
    }
  } else if (tab === 'er' || tab === 'bal' || tab === 'flu') {
    const def = { er: DEF_ER, bal: DEF_BAL, flu: DEF_FLU }[tab];
    if (!A.length) { el.innerHTML = finCard('Anual', none); return; }
    const t = stmtTable(A, def, yr);
    el.innerHTML = finCard('Anual', tblHTML(t.head, t.body)) + `<div class="card"><h3>Evolución <span class="sub">millones</span></h3><div class="chart"><canvas id="c-fin3"></canvas></div></div>`;
    const keys = { er: [['Ingresos', 'totalRevenue', c.accent], ['Utilidad de operación', 'operatingIncome', c.s3], ['Utilidad neta', 'netIncome', c.ochre]], bal: [['Activo total', 'totalAssets', c.accent], ['Pasivo total', 'totalLiabilitiesNetMinorityInterest', c.down], ['Capital contable', 'stockholdersEquity', c.up]], flu: [['Operación', 'operatingCashFlow', c.accent], ['Inversión', 'investingCashFlow', c.down], ['Financiamiento', 'financingCashFlow', c.s3], ['Flujo libre', 'freeCashFlow', c.up]] }[tab];
    mkChart('c-fin3', { type: 'bar', data: { labels: A.map((r) => yr(r.date)), datasets: keys.map(([l, k, col]) => ({ label: l, data: A.map((r) => (r[k] ?? null) && r[k] / 1e6), backgroundColor: col })) }, options: baseOpts(c, { scales: axes(c) }) });
  } else if (tab === 'rat') {
    if (!A.length) { el.innerHTML = finCard('Razones financieras', none); return; }
    const t = stmtTable(A, DEF_RAT, yr); t.head[0] = 'Razón';
    const lastA = A[A.length - 1], eps = lastA.netIncome / (lastA.ordinarySharesNumber || sv('defaultKeyStatistics.sharesOutstanding'));
    const bvps = lastA.stockholdersEquity / (lastA.ordinarySharesNumber || sv('defaultKeyStatistics.sharesOutstanding'));
    el.innerHTML = `<div class="stats">${stat('P/U con último anual', fmt(px / eps, 1) + '×', `UPA ${fmt(eps)}`)}${stat('P/VL', fmt(px / bvps, 2) + '×', `VL por acción ${fmt(bvps)}`)}${stat('Rend. utilidades', pct(eps / px))}${stat('ROE último', pct(lastA.netIncome / lastA.stockholdersEquity))}</div>` + finCard('Razones financieras por año', tblHTML(t.head, t.body));
  } else if (tab === 'div') {
    const dv = [...S.divs].sort((a, b) => b.d.localeCompare(a.d));
    const byY = {}; dv.forEach((x) => (byY[yr(x.d)] = (byY[yr(x.d)] || 0) + x.amount));
    const ys = Object.keys(byY).sort();
    const pxAt = (d) => { const r = S.all.find((x) => x.d >= d); return r ? r.c : px; };
    el.innerHTML = `<div class="stats">${stat('Dividendo anual', '$' + fmt(sv('summaryDetail.dividendRate') ?? byY[ys[ys.length - 1]]))}${stat('Rendimiento', pct(divYield().q), divYield().src)}${stat('Razón de pago', pct(sv('summaryDetail.payoutRatio')))}${stat('Pagos registrados', dv.length)}</div>
    <div class="grid g2"><div class="card"><h3>Dividendos por año <span class="sub">por acción</span></h3><div class="chart"><canvas id="c-div"></canvas></div></div>
    ${finCard('Historial de pagos', tblHTML(['Fecha', 'Monto', 'Rend. al pago'], dv.map((x) => [x.d, '$' + fmt(x.amount, 3), pct(x.amount / pxAt(x.d))])) || none)}</div>
    <p class="note">El rendimiento por dividendo alimenta el parámetro q de Black-Scholes, del binomial y del precio teórico del futuro.</p>`;
    mkChart('c-div', { type: 'bar', data: { labels: ys, datasets: [{ label: 'Dividendo por acción', data: ys.map((y) => byY[y]), backgroundColor: c.ochre }] }, options: baseOpts(c, { scales: axes(c) }) });
  } else if (tab === 'rep') {
    const ed = sv('calendarEvents.earnings.earningsDate');
    const next = Array.isArray(ed) && ed.length ? String(ed[0]).slice(0, 10) : null;
    if (!Qr.length) { el.innerHTML = finCard('Reportes trimestrales', none); return; }
    const t = stmtTable(Qr, [...DEF_ER.slice(0, 6), DEF_ER[9], ['Flujo de operación', 'operatingCashFlow'], ['Deuda total', 'totalDebt'], ['Margen neto', (r) => r.netIncome / r.totalRevenue, 'pct']], qlab);
    el.innerHTML = `<div class="stats">${stat('Próximo reporte', next || '—')}${stat('Trimestres disponibles', Qr.length)}${stat('Crec. ingresos a/a', Qr.length >= 5 ? pct(Qr[Qr.length - 1].totalRevenue / Qr[Qr.length - 5].totalRevenue - 1) : '—', 'último trimestre')}</div>` + finCard('Reportes trimestrales', tblHTML(t.head, t.body)) + `<div class="card"><h3>Ingresos y utilidad trimestral <span class="sub">millones</span></h3><div class="chart"><canvas id="c-q"></canvas></div></div>`;
    mkChart('c-q', { type: 'bar', data: { labels: Qr.map((r) => qlab(r.date)), datasets: [{ label: 'Ingresos', data: Qr.map((r) => r.totalRevenue / 1e6), backgroundColor: c.accent }, { label: 'Utilidad neta', data: Qr.map((r) => r.netIncome / 1e6), backgroundColor: c.ochre }] }, options: baseOpts(c, { scales: axes(c) }) });
  } else if (tab === 'prev') {
    const tr = sv('earningsTrend.trend') || [];
    const lab = { '0q': 'Trimestre actual', '+1q': 'Siguiente trimestre', '0y': 'Año actual', '+1y': 'Siguiente año' };
    const rows = tr.filter((t) => lab[t.period]).map((t) => [lab[t.period], fmt(t.earningsEstimate?.avg?.raw ?? t.earningsEstimate?.avg), big(t.revenueEstimate?.avg?.raw ?? t.revenueEstimate?.avg), pct(t.growth?.raw ?? t.growth)]);
    // Proyección propia: CAGR de ingresos y margen neto promedio
    let proj = '';
    if (A.length >= 2) {
      const f0 = A[0], f1 = A[A.length - 1], yrs = A.length - 1, g = Math.pow(f1.totalRevenue / f0.totalRevenue, 1 / yrs) - 1, nm = Q.mean(A.map((r) => r.netIncome / r.totalRevenue));
      const sh = f1.ordinarySharesNumber || sv('defaultKeyStatistics.sharesOutstanding'), pe = px / (f1.netIncome / sh);
      const pr = [1, 2, 3].map((k) => { const rev = f1.totalRevenue * Math.pow(1 + g, k), ni = rev * nm, eps = ni / sh; return [String(+yr(f1.date) + k) + 'e', fmt(rev / 1e6, 0), fmt(ni / 1e6, 0), fmt(eps), fmt(eps * pe)]; });
      proj = finCard(`Proyección propia <span class="sub">CAGR ingresos ${pct(g, 1)} · margen neto medio ${pct(nm, 1)} · P/U constante ${fmt(pe, 1)}×</span>`, tblHTML(['Año', 'Ingresos (M)', 'Utilidad neta (M)', 'UPA', 'Precio implícito'], pr));
    }
    el.innerHTML = `<div class="grid g2">${finCard('Estimaciones de analistas', rows.length ? tblHTML(['Período', 'UPA estimada', 'Ingresos estimados', 'Crecimiento'], rows) : none)}${proj}</div>
      <div class="card"><h3>Cono de precio a 12 meses <span class="sub">percentiles 5 · 25 · 50 · 75 · 95, modelo lognormal con σ calibrada</span></h3><div class="chart"><canvas id="c-cone"></canvas></div></div>`;
    const v = volEstimates().ewma || 0.25, mu = histDrift(), months = 12, labs = [], pcs = [0.05, 0.25, 0.5, 0.75, 0.95].map(() => []);
    for (let m = 0; m <= months; m++) { labs.push(m === 0 ? 'Hoy' : `+${m} m`); const t = m / 12; [0.05, 0.25, 0.5, 0.75, 0.95].forEach((p, i) => pcs[i].push(px * Math.exp((mu - 0.5 * v * v) * t + Q.ninv(p) * v * Math.sqrt(t || 1e-9)))); }
    const o = baseOpts(c, { scales: axes(c) }); const tgt = sv('financialData.targetMeanPrice');
    o.plugins.hlines = { lines: isNum(tgt) ? [{ y: tgt, color: c.s3, label: `Objetivo analistas ${fmt(tgt)}` }] : [] };
    mkChart('c-cone', { type: 'line', data: { labels: labs, datasets: [lineDS('P95', pcs[4], alpha(c.accent, 0.35), { fill: '+4', backgroundColor: alpha(c.accent, 0.08) }), lineDS('P75', pcs[3], alpha(c.accent, 0.6), { fill: '+2', backgroundColor: alpha(c.accent, 0.12) }), lineDS('Mediana', pcs[2], c.accent, { borderWidth: 2 }), lineDS('P25', pcs[1], alpha(c.accent, 0.6)), lineDS('P5', pcs[0], alpha(c.accent, 0.35))] }, options: o });
  }
}
function histDrift() { const c = S.all.slice(-756).map((x) => x.c); if (c.length < 60) return 0.08; const r = Q.logret(c); const m = Q.mean(r) * 252 + 0.5 * (Q.std(r) ** 2) * 252; return Math.max(-0.4, Math.min(0.4, m)); }
