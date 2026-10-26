/* ===================== UI 2: riesgos, chartismo, futuros, opciones ===================== */
// ---------- 04 Patrones y riesgos ----------
function joined() {
  const m = new Map(S.bench.map((b) => [b.d, b]));
  const s = [], b = [];
  for (const r of S.all) { const x = m.get(r.d); if (x) { s.push(r); b.push(x); } }
  return { s, b };
}
function betaStats(sr, br) {
  if (sr.length < 6) return { beta: NaN, corr: NaN, r2: NaN, alpha: NaN, n: sr.length };
  const rs = Q.logret(sr.map((x) => x.c)), rb = Q.logret(br.map((x) => x.c));
  const cv = Q.cov(rs, rb), vb = Q.cov(rb, rb), beta = cv / vb, corr = cv / (Q.std(rs) * Q.std(rb));
  return { beta, corr, r2: corr * corr, alpha: Q.mean(rs) - beta * Q.mean(rb), n: rs.length, rs, rb };
}
function windowFilter(rows) {
  const w = $('#r-win').value;
  if (w === 'custom') { const f = $('#r-from').value, t = $('#r-to').value; return rows.filter((r) => (!f || r.d >= f) && (!t || r.d <= t)); }
  const n = parseInt(w); const cut = S.all[Math.max(0, S.all.length - n)]?.d || ''; return rows.filter((r) => r.d >= cut);
}
function betaFor(cycle, n, useWindow) {
  const j = joined(); let s = j.s, b = j.b;
  if (useWindow) { const keep = new Set(windowFilter(s).map((x) => x.d)); s = s.filter((x) => keep.has(x.d)); b = b.filter((x) => keep.has(x.d)); }
  return betaStats(resample(s, cycle, n), resample(b, cycle, n));
}
function riskMetrics() {
  const B = bars(), c = B.map((b) => b.c), r = Q.logret(c), ppyv = ppy();
  const sd = Q.std(r), vol = sd * Math.sqrt(ppyv), mu = Q.mean(r);
  let peak = -Infinity, mdd = 0; const dd = c.map((x) => { peak = Math.max(peak, x); const d = x / peak - 1; mdd = Math.min(mdd, d); return d; });
  const rf = (parseFloat($('#p-r').value) || 7) / 100;
  const tail = r.filter((x) => x <= Q.quantile(r, 0.05));
  return { B, r, vol, var95: -(mu + Q.ninv(0.05) * sd), var99: -(mu + Q.ninv(0.01) * sd), hvar95: -Q.quantile(r, 0.05), cvar95: -Q.mean(tail), mdd, dd, sharpe: (mu * ppyv - rf) / vol, ret: mu * ppyv };
}
function renderRiesgo() {
  const c = COL(), rm = riskMetrics(), B = rm.B; if (B.length < 20) return;
  const bg = betaFor('D', 1, false), bw = betaFor(S.cycle, S.nDays, true);
  const winTxt = $('#r-win').selectedOptions[0].textContent;
  $('#r-stats').innerHTML = [
    stat('Beta general', fmt(bg.beta, 2), `diaria, ${bg.n} obs.`), stat('Beta selección', fmt(bw.beta, 2), `${cycleName()}, ${winTxt.toLowerCase()}`),
    stat('Correlación con IPC', fmt(bw.corr, 2), `R² ${fmt(bw.r2, 2)}`), stat('Volatilidad anual', pct(rm.vol, 1), cycleName()),
    stat('VaR 95% por barra', pct(rm.var95), `histórico ${pct(rm.hvar95)}`, 'down'), stat('VaR 99% por barra', pct(rm.var99), '', 'down'),
    stat('CVaR 95%', pct(rm.cvar95), 'pérdida media en la cola', 'down'), stat('Caída máxima', pct(rm.mdd, 1), 'desde máximo previo', 'down'),
    stat('Rendimiento anualizado', pct(rm.ret, 1), '', rm.ret >= 0 ? 'up' : 'down'), stat('Sharpe', fmt(rm.sharpe, 2), `r = ${$('#p-r').value}%`),
  ].join('');
  const tr = trendInfo(B), cl = B.map((b) => b.c);
  const o = baseOpts(c, { scales: axes(c) });
  mkChart('c-trend', { type: 'line', data: { labels: B.map((b) => b.d), datasets: [lineDS('Cierre', cl, c.ink, { borderWidth: 1.3 }), lineDS(`Primaria MM${tr.P}`, tr.smaP, c.accent, { borderWidth: 2 }), lineDS(`Secundaria MM${tr.Sc}`, tr.smaS, c.ochre, { borderWidth: 1.6 })] }, options: o });
  const chip = (t) => `<span class="chip ${t === 'Alcista' ? 'bull' : t === 'Bajista' ? 'bear' : 'flat'}">${t}</span>`;
  $('#r-trend').innerHTML = `<span class="small muted">Primaria (MM${tr.P})</span>${chip(tr.primary)}<span class="small muted num">pendiente ${pct(tr.sp * ppy(), 1)} anual</span><span class="small muted" style="margin-left:12px">Secundaria (MM${tr.Sc})</span>${chip(tr.secondary)}<span class="small muted num">pendiente ${pct(tr.ss * ppy(), 1)} anual</span>`;
  const rows = [['Diario', 'D', 1], ['Semanal', 'W', 1], ['Mensual', 'M', 1], [`Cada ${S.nDays} días`, 'N', S.nDays]].map(([lab, cy, n]) => { const g = betaFor(cy, n, false), w = betaFor(cy, n, true); return { _cls: cy === S.cycle ? 'hl' : '', 0: lab, 1: fmt(g.beta, 2), 2: fmt(w.beta, 2), 3: fmt(w.corr, 2), 4: w.n, length: 5 }; }).map((r) => Object.assign(Array.from(r), { _cls: r._cls }));
  table('#t-beta', ['Ciclo', 'β general', `β ${winTxt.toLowerCase()}`, 'Correlación', 'Obs.'], rows);
  $('#r-scsub').textContent = `${cycleName()} · ${winTxt.toLowerCase()} · β ${fmt(bw.beta, 2)}`;
  if (bw.rs) {
    const pts = bw.rb.map((x, i) => ({ x: x * 100, y: bw.rs[i] * 100 }));
    const xs = pts.map((p) => p.x), mn = Math.min(...xs), mx = Math.max(...xs), a = bw.alpha * 100;
    const so = baseOpts(c, { interaction: { mode: 'nearest', intersect: true }, scales: axes(c, { x: { type: 'linear', title: { display: true, text: 'IPC %', color: c.muted }, ticks: { color: c.muted, callback: (v) => fmt(v, 1) } }, y: { title: { display: true, text: 'Emisora %', color: c.muted }, ticks: { color: c.muted, callback: (v) => fmt(v, 1) } } }) });
    so.plugins.tooltip.callbacks.label = (it) => `IPC ${fmt(it.parsed.x)}% · emisora ${fmt(it.parsed.y)}%`;
    mkChart('c-scatter', { type: 'scatter', data: { datasets: [{ label: 'Rendimientos', data: pts, backgroundColor: alpha(c.accent, 0.45), pointRadius: 2.5 }, { type: 'line', label: `β = ${fmt(bw.beta, 2)}`, data: [{ x: mn, y: a + bw.beta * mn }, { x: mx, y: a + bw.beta * mx }], borderColor: c.ochre, borderWidth: 2, pointRadius: 0 }] }, options: so });
  }
  const j = joined(), js = resample(j.s, S.cycle, S.nDays), jb = resample(j.b, S.cycle, S.nDays), w = Math.max(10, +$('#r-roll').value || 60);
  const rs = Q.logret(js.map((x) => x.c)), rb = Q.logret(jb.map((x) => x.c)), rbeta = [];
  for (let i = 0; i < rs.length; i++) { if (i < w) { rbeta.push(null); continue; } const a1 = rs.slice(i - w, i), b1 = rb.slice(i - w, i); rbeta.push(Q.cov(a1, b1) / Q.cov(b1, b1)); }
  const ro = baseOpts(c, { scales: axes(c) }); ro.plugins.hlines = { lines: [{ y: 1, color: c.muted, label: 'β = 1' }] };
  mkChart('c-rbeta', { type: 'line', data: { labels: js.slice(1).map((x) => x.d), datasets: [lineDS(`β móvil ${w}`, rbeta, c.s3)] }, options: ro });
  const dO = baseOpts(c, { scales: axes(c, { y: { ticks: { color: c.muted, callback: (v) => fmt(v * 100, 0) + '%' } } }) }); dO.plugins.tooltip.callbacks.label = (it) => 'Caída: ' + pct(it.parsed.y, 1);
  mkChart('c-dd', { type: 'line', data: { labels: B.map((b) => b.d), datasets: [lineDS('Drawdown', rm.dd, c.down, { fill: { target: 'origin', below: alpha(c.down, 0.15) }, borderWidth: 1.2 })] }, options: dO });
}

// ---------- 05 Chartismo ----------
function renderChart() {
  const c = COL(), all = bars(), k = Math.max(2, +$('#ch-k').value || 5), nb = Math.max(40, +$('#ch-n').value || 180);
  const B = all.slice(-nb); if (B.length < 30) return;
  const sr = supportResistance(B, k), fg = detectFigures(B, k), last = B[B.length - 1].c;
  const lines = [...sr.res.slice(0, 3).map((x) => ({ y: x.p, color: c.down, label: `R ${fmt(x.p)} (${x.n} toques)`, dash: [6, 3] })), ...sr.sup.slice(0, 3).map((x) => ({ y: x.p, color: c.up, label: `S ${fmt(x.p)} (${x.n} toques)`, dash: [6, 3] }))];
  const ov = [];
  for (const f of fg.figs) {
    (f.lines || []).forEach((L) => lines.push({ y: L.y, color: c.ochre, label: `${L.label} ${fmt(L.y)}`, dash: [2, 3], w: 1.5 }));
    if (f.trend) { const { fh, fl, from } = f.trend; ov.push(lineDS(f.name + ' (sup.)', B.map((_, i) => (i >= from ? fh.i0 + fh.s * i : null)), c.s3, { borderWidth: 1.5, borderDash: [5, 3] }), lineDS(f.name + ' (inf.)', B.map((_, i) => (i >= from ? fl.i0 + fl.s * i : null)), c.s3, { borderWidth: 1.5, borderDash: [5, 3] })); }
  }
  ov.push({ type: 'line', label: 'Pivote alto', data: B.map((_, i) => (fg.ph.find((p) => p.i === i) ? B[i].h * 1.004 : null)), showLine: false, pointRadius: 3.5, pointStyle: 'triangle', rotation: 180, backgroundColor: c.down, borderColor: c.down });
  ov.push({ type: 'line', label: 'Pivote bajo', data: B.map((_, i) => (fg.pl.find((p) => p.i === i) ? B[i].l * 0.996 : null)), showLine: false, pointRadius: 3.5, pointStyle: 'triangle', backgroundColor: c.up, borderColor: c.up });
  mkChart('c-chart', cfgCandles(B, c, ov, lines));
  const sc = fg.figs.reduce((s, f) => s + (f.bias === 'alcista' ? 1 : f.bias === 'bajista' ? -1 : 0) * (f.w || 0.5), 0);
  const vw = sc > 0.5 ? 'Alcista' : sc < -0.5 ? 'Bajista' : 'Neutral';
  const ch = $('#ch-view'); ch.textContent = `Sesgo ${vw.toLowerCase()}`; ch.className = 'chip ' + (vw === 'Alcista' ? 'bull' : vw === 'Bajista' ? 'bear' : 'flat');
  $('#ch-figs').innerHTML = fg.figs.length ? fg.figs.map((f) => `<div class="fig"><div class="top"><b>${esc(f.name)}</b><span class="chip ${f.bias === 'alcista' ? 'bull' : f.bias === 'bajista' ? 'bear' : 'flat'}">${f.bias}</span></div>
    <span class="small muted">${esc(f.state)}</span><span class="small">Postura sugerida: <b>${esc(f.post)}</b></span>
    ${isNum(f.target) ? `<span class="small num muted">Objetivo ${fmt(f.target)} (${pct(f.target / last - 1, 1)}) · Stop ${fmt(f.stop)}</span>` : ''}</div>`).join('')
    : '<p class="muted small">No se detectan figuras con la sensibilidad actual. Reduce la sensibilidad del pivote o amplía las barras analizadas.</p>';
  const rows = [...sr.res.slice().reverse(), ...sr.sup].map((x) => [x.kind, fmt(x.p), { v: pct(x.dist), c: cls(x.dist) }, x.n, B[x.last]?.d || '']);
  table('#t-sr', ['Nivel', 'Precio', 'Distancia', 'Toques', 'Último toque'], rows.length ? rows : [['Sin niveles con 2+ toques', '', '', '', '']]);
}

// ---------- 06 Futuros ----------
function suggestedSide() { const B = bars(); if (B.length < 30) return { side: 1, why: '' }; const tr = technicalRead(B); return { side: tr.score >= 0 ? 1 : -1, why: `lectura ${tr.view.toLowerCase()} (puntaje ${fmt(tr.score, 1)})`, view: tr.view, score: tr.score }; }
function aimPerContract(p, Fp) {
  const man = parseFloat($('#f-aimm').value);
  if (isNum(man) && man > 0) return p.size * Fp * man / 100;
  const z = Q.ninv(+$('#f-conf').value || 0.99), h = Math.max(1, +$('#f-hz').value || 2);
  return p.size * Fp * (p.v / Math.sqrt(252)) * z * Math.sqrt(h);
}
function futCtx() {
  const p = P(), sg = suggestedSide(); const sel = $('#f-side').value;
  const side = sel === 'auto' ? sg.side : +sel;
  const Fp = parseFloat($('#f-price').value) || p.F;
  const aim = aimPerContract(p, Fp);
  return { p, sg, side, Fp, aim, aimT: aim * p.n, nom: p.size * p.n * Fp };
}
function renderFut() {
  const c = COL(), x = futCtx(), p = x.p;
  $('#f-side-h').textContent = $('#f-side').value === 'auto' ? `${x.side > 0 ? 'Compra' : 'Venta'} por ${x.sg.why}` : '';
  $('#f-stats').innerHTML = [
    stat('Spot', '$' + fmt(p.spot)), stat('Futuro teórico', '$' + fmt(p.F), `${p.termLabel} · F = S·e^(r−q)T`), stat('Base (F − S)', fmt(p.F - p.spot), pct(p.F / p.spot - 1) + ' de acarreo'),
    stat('Precio pactado', '$' + fmt(x.Fp), x.side > 0 ? 'Compra (larga)' : 'Venta (corta)', x.side > 0 ? 'up' : 'down'),
    stat('Valor nocional', money(x.nom, 0), `${p.n} contratos × ${p.size} acciones`), stat('AIM por contrato', money(x.aim), pct(x.aim / (p.size * x.Fp)) + ' del nocional'),
    stat('AIM total', money(x.aimT, 0), pct(x.aimT / p.cap, 1) + ' del capital'), stat('Apalancamiento', fmt(x.nom / x.aimT, 1) + '×', 'nocional / AIM'),
    stat('Resultado por $1 de movimiento', money(x.side * p.size * p.n, 0)),
  ].join('');
  const rows = []; for (let m = -0.2; m <= 0.2001; m += 0.025) { const ST = p.spot * (1 + m), pl = x.side * (ST - x.Fp) * p.size * p.n; rows.push(Object.assign([pct(m, 1), fmt(ST), { v: money(pl, 0), c: cls(pl) }, { v: pct(pl / x.aimT, 1), c: cls(pl) }, { v: pct(pl / p.cap, 2), c: cls(pl) }], { _cls: Math.abs(m) < 1e-9 ? 'hl' : '' })); }
  table('#t-fpl', ['Mov. spot', 'Precio final', 'Resultado', 'Sobre AIM', 'Sobre capital'], rows);
  // Simulación de liquidación diaria
  const steps = Math.max(2, Math.round(p.days * 252 / 365)), paths = Q.simulate(p.spot, p.T, p.r - p.q, p.v, 500, steps, Q.hashStr(S.symbol) + steps);
  const am = $('#f-style').value === 'am', tp = (parseFloat($('#f-tp').value) || 0) / 100;
  const pc = [0.05, 0.25, 0.5, 0.75, 0.95], bands = pc.map(() => new Array(steps + 1));
  const bal = paths.map((path) => { const b = new Float64Array(steps + 1); b[0] = x.aimT; for (let i = 1; i <= steps; i++) { const tau = p.T * (1 - i / steps), F0 = path[i - 1] * Math.exp((p.r - p.q) * (tau + p.T / steps)), F1 = path[i] * Math.exp((p.r - p.q) * tau); b[i] = b[i - 1] + x.side * (F1 - F0) * p.size * p.n; } return b; });
  for (let i = 0; i <= steps; i++) { const col = bal.map((b) => b[i]); pc.forEach((q, k) => (bands[k][i] = Q.quantile(col, q))); }
  const thr = x.aimT * 0.8; let calls = 0, anyCall = 0, eu = [], amv = [], hit = 0;
  bal.forEach((b, k) => { let n = 0, below = false; for (let i = 1; i <= steps; i++) { const isB = b[i] < thr; if (isB && !below) n++; below = isB; } calls += n; if (n) anyCall++; eu.push(b[steps] - x.aimT);
    if (am && tp > 0) { let done = false; for (let i = 1; i <= steps; i++) { const tau = p.T * (1 - i / steps), Ft = paths[k][i] * Math.exp((p.r - p.q) * tau); if (x.side * (Ft / x.Fp - 1) >= tp) { amv.push(b[i] - x.aimT); hit++; done = true; break; } } if (!done) amv.push(b[steps] - x.aimT); } });
  const o = baseOpts(c, { scales: axes(c, { y: { ticks: { color: c.muted, callback: (v) => big(v) } } }) });
  o.plugins.hlines = { lines: [{ y: x.aimT, color: c.accent, label: 'AIM' }, { y: thr, color: c.down, label: 'Llamada de margen (80% AIM)' }] };
  o.plugins.tooltip.callbacks.label = (it) => `${it.dataset.label}: ${money(it.parsed.y, 0)}`;
  const lab = Array.from({ length: steps + 1 }, (_, i) => `día ${i}`);
  mkChart('c-fsim', { type: 'line', data: { labels: lab, datasets: [lineDS('P95', bands[4], alpha(c.accent, 0.4), { fill: '+4', backgroundColor: alpha(c.accent, 0.08) }), lineDS('P75', bands[3], alpha(c.accent, 0.6), { fill: '+2', backgroundColor: alpha(c.accent, 0.12) }), lineDS('Mediana', bands[2], c.accent, { borderWidth: 2 }), lineDS('P25', bands[1], alpha(c.accent, 0.6)), lineDS('P5', bands[0], alpha(c.accent, 0.4))] }, options: o });
  const pw = (a) => a.filter((v) => v > 0).length / a.length;
  $('#f-simstats').innerHTML = [stat('Prob. de llamada de margen', pct(anyCall / 500, 1), `${fmt(calls / 500, 2)} llamadas promedio`), stat('Resultado medio (europeo)', money(Q.mean(eu), 0), `P(ganancia) ${pct(pw(eu), 1)}`, Q.mean(eu) >= 0 ? 'up' : 'down'),
    am ? stat('Resultado medio (americano)', money(Q.mean(amv), 0), `cierre anticipado en ${pct(hit / 500, 1)} de los casos · P(ganancia) ${pct(pw(amv), 1)}`, Q.mean(amv) >= 0 ? 'up' : 'down') : stat('VaR 95% al vencimiento', money(-Q.quantile(eu, 0.05), 0), '', 'down')].join('');
  // Americano vs europeo
  const K = roundTick(p.spot, p.spot), out = [];
  for (const t of ['C', 'P']) { const e = Q.binomial(p.spot, K, p.T, p.r, p.q, p.v, 200, t, false).price, a = Q.binomial(p.spot, K, p.T, p.r, p.q, p.v, 200, t, true).price; out.push({ t, e, a, prem: a - e }); }
  const big1 = out.find((o) => o.t === (x.side > 0 ? 'C' : 'P'));
  const recAm = am ? hit / 500 > 0.15 || big1.prem / big1.e > 0.01 : big1.prem / big1.e > 0.01;
  $('#f-type').innerHTML = `<div class="grid g2"><div>${tblHTML(['Opción ATM sobre el plazo', 'Europea', 'Americana', 'Prima por ejercicio anticipado'], out.map((o) => [o.t === 'C' ? `Call K ${fmt(K)}` : `Put K ${fmt(K)}`, fmt(o.e, 4), fmt(o.a, 4), `${fmt(o.prem, 4)} (${pct(o.prem / o.e, 2)})`]))}</div>
    <div class="desc"><p><b>Europeo:</b> la posición se liquida al vencimiento; solo hay liquidación diaria de pérdidas y ganancias. <b>Americano:</b> permite cerrar o ejercer antes, lo que en la simulación equivale a tomar utilidad al ${$('#f-tp').value}% de movimiento a favor.</p>
    <p style="margin-top:8px"><span class="chip ${recAm ? 'info' : 'flat'} plain">Sugerencia: ${recAm ? 'Americano' : 'Europeo'}</span> ${recAm ? 'La flexibilidad de salida anticipada aporta valor con estos parámetros (dividendos, tasa o probabilidad de alcanzar el objetivo).' : 'El valor del ejercicio anticipado es marginal; el europeo es más barato y suficiente si mantendrás la postura al vencimiento.'}</p></div></div>`;
}

// ---------- 07 Opciones ----------
S.smile = null;
function renderOpc() {
  const c = COL(), p = P(), ve = volEstimates();
  const K = parseFloat($('#o-K').value) || roundTick(p.spot, p.spot), type = $('#o-type').value, side = +$('#o-side').value, am = $('#o-style').value === 'am';
  const mkt = parseFloat($('#o-mkt').value), iv = isNum(mkt) ? Q.impliedVol(mkt, p.spot, K, p.T, p.r, p.q, type) : NaN;
  const calRows = [['Histórica diaria (1 año)', ve.hist], ['Histórica semanal (2 años)', ve.histW], ['Histórica mensual (5 años)', ve.histM], ['EWMA λ 0.94', ve.ewma], ['Parkinson (rango M/m)', ve.park], ['Implícita (prima de mercado)', iv]]
    .map(([l, v]) => [l, pct(v, 2), isNum(v) ? fmt(Q.bs(p.spot, K, p.T, p.r, p.q, v, type).price, 4) : '—']);
  table('#t-cal', ['Método', 'σ anual', `Prima ${type === 'C' ? 'call' : 'put'} K ${fmt(K)}`], calRows);
  $('#o-calnote').textContent = `σ en uso: ${pct(p.v, 2)} (${$('#p-volm').selectedOptions[0].textContent}). La calibración automática usa la σ implícita si capturas una prima de mercado; si no, la EWMA, que pondera más la volatilidad reciente.`;
  // Sonrisa
  if (!S.smile || S.smile.sym !== S.symbol) { const ks = [0.9, 0.95, 1, 1.05, 1.1].map((m) => roundTick(p.spot * m, p.spot)); S.smile = { sym: S.symbol, ex: true, rows: ks.map((k) => ({ K: k, t: k < p.spot ? 'P' : 'C', prem: +Q.bs(p.spot, k, p.T, p.r, p.q, p.v * (1 + 0.9 * Math.abs(Math.log(k / p.spot)) + (k < p.spot ? 0.08 : 0)), k < p.spot ? 'P' : 'C').price.toFixed(2) })) }; }
  const sm = S.smile.rows.map((r) => ({ ...r, iv: Q.impliedVol(r.prem, p.spot, r.K, p.T, p.r, p.q, r.t) }));
  $('#t-smile').innerHTML = `<thead><tr><th>Strike</th><th>Tipo</th><th>Prima</th><th>σ implícita</th></tr></thead><tbody>${sm.map((r, i) => `<tr><td>${fmt(r.K)}</td><td class="t">${r.t === 'C' ? 'Call' : 'Put'}</td><td><input type="number" step="0.01" value="${r.prem}" data-i="${i}" class="smile-in" style="width:90px;height:26px" aria-label="Prima strike ${r.K}"></td><td>${pct(r.iv, 2)}</td></tr>`).join('')}</tbody>`;
  $$('.smile-in').forEach((el) => el.addEventListener('change', () => { S.smile.rows[+el.dataset.i].prem = parseFloat(el.value) || 0; S.smile.ex = false; renderOpc(); }));
  const so = baseOpts(c, { scales: axes(c, { x: { type: 'linear', ticks: { color: c.muted } }, y: { ticks: { color: c.muted, callback: (v) => fmt(v * 100, 0) + '%' } } }) });
  so.plugins.hlines = { lines: [{ x: p.spot, color: c.muted, label: 'spot' }] }; so.plugins.tooltip.callbacks.label = (it) => `σ ${pct(it.parsed.y, 2)}`;
  mkChart('c-smile', { type: 'line', data: { datasets: [lineDS(S.smile.ex ? 'σ implícita (primas de ejemplo)' : 'σ implícita', sm.map((r) => ({ x: r.K, y: r.iv })), c.s3, { pointRadius: 4, tension: 0.3 }), lineDS('σ en uso', sm.map((r) => ({ x: r.K, y: p.v })), c.muted, { borderDash: [4, 4] })] }, options: so });
  // Contrato básico
  const g = Q.bs(p.spot, K, p.T, p.r, p.q, p.v, type);
  const binA = Q.binomial(p.spot, K, p.T, p.r, p.q, p.v, 300, type, true).price, binE = Q.binomial(p.spot, K, p.T, p.r, p.q, p.v, 300, type, false).price;
  const theo = am ? binA : g.price, prem = parseFloat($('#o-prem').value) || theo;
  const be = type === 'C' ? K + prem : K - prem, mult = p.size * p.n;
  const legs = [{ k: type, q: side, K, prem }];
  const m = Q.strategyMetrics(legs, p.spot, mult);
  const sq = Math.sqrt(p.T), dBE = (Math.log(p.spot / be) + (p.r - p.q - 0.5 * p.v * p.v) * p.T) / (p.v * sq);
  const pAbove = Q.N(dBE), pWin = side > 0 ? (type === 'C' ? pAbove : 1 - pAbove) : (type === 'C' ? 1 - pAbove : pAbove);
  $('#o-stats').innerHTML = [stat('Prima Black-Scholes', fmt(g.price, 4), 'europea'), stat('Prima binomial', `${fmt(binE, 4)} / ${fmt(binA, 4)}`, 'europea / americana, 300 pasos'), stat('Prima pactada', fmt(prem, 4), am ? 'americana' : 'europea'),
    stat(side > 0 ? 'Prima total pagada' : 'Prima total cobrada', money(prem * mult, 0), `${p.n} contratos × ${p.size}`, side > 0 ? 'down' : 'up'), stat('Punto de equilibrio', '$' + fmt(be), pct(be / p.spot - 1) + ' vs spot'),
    stat('Ganancia máxima', money(m.maxGain, 0), '', 'up'), stat('Pérdida máxima', money(m.maxLoss, 0), '', 'down'), stat('Prob. de ejercicio', pct(g.pITM, 1), 'N(d₂), neutral al riesgo'), stat('Prob. de ganancia', pct(pWin, 1), 'precio final más allá del equilibrio')].join('');
  const gr = [['Delta', g.delta, 'Δ precio por $1 del subyacente'], ['Gamma', g.gamma, 'Δ delta por $1'], ['Vega', g.vega, 'por 1 punto de volatilidad'], ['Theta', g.theta, 'por día natural'], ['Rho', g.rho, 'por 1 punto de tasa']];
  table('#t-greeks', ['Griega', 'Por acción', 'Posición', 'Lectura'], gr.map(([n, v, t]) => [n, fmt(v, 4), { v: money(v * side * mult, 0), c: cls(v * side) }, { v: t, c: 't' }]));
  $('#o-risk').innerHTML = `<p class="note">Riesgos: ${side > 0 ? `el tiempo resta ${money(Math.abs(g.theta * mult), 0)} por día (theta) y la pérdida se limita a la prima` : `la pérdida ${type === 'C' ? 'no tiene límite si el precio sube' : `puede llegar a ${money((K - prem) * mult, 0)} si el precio cae a cero`}; requiere AIM y vigilancia del delta`}. Equivale a ${fmt(Math.abs(g.delta * side * mult), 0)} acciones ${g.delta * side > 0 ? 'largas' : 'cortas'} (delta). Dividendos: q = ${pct(p.q, 2)} reduce el valor del call y eleva el del put.</p>`;
  const xs = []; for (let i = 0; i <= 120; i++) xs.push(p.spot * (0.7 + 0.6 * i / 120));
  const po = baseOpts(c, { scales: axes(c, { x: { type: 'linear', ticks: { color: c.muted, callback: (v) => fmt(v, 0) } }, y: { ticks: { color: c.muted, callback: (v) => big(v) } } }) });
  po.plugins.hlines = { lines: [{ y: 0, color: c.muted, dash: [] }, { x: p.spot, color: c.accent, label: 'spot' }, { x: be, color: c.ochre, label: 'equilibrio' }] };
  po.plugins.tooltip.callbacks.label = (it) => `${it.dataset.label}: ${money(it.parsed.y, 0)}`; po.plugins.tooltip.callbacks.title = (it) => 'Subyacente ' + fmt(it[0].parsed.x);
  mkChart('c-opay', { type: 'line', data: { datasets: [lineDS('Al vencimiento', xs.map((s) => ({ x: s, y: Q.payoff(legs, s, mult) })), c.accent, { borderWidth: 2 }), lineDS('Hoy (Black-Scholes)', xs.map((s) => ({ x: s, y: Q.valueAt(legs, s, p.T, p.r, p.q, p.v, mult) })), c.ochre, { borderDash: [5, 4] })] }, options: po });
  // Binomial
  const n = Math.max(1, Math.min(500, +$('#b-n').value || 6));
  const bt = Q.binomial(p.spot, K, p.T, p.r, p.q, p.v, n, type, am, n <= 8);
  $('#b-stats').innerHTML = [stat('Factor de subida u', fmt(bt.u, 5), 'e^(σ√Δt)'), stat('Factor de bajada d', fmt(bt.d, 5), '1/u'), stat('Prob. neutral p', fmt(bt.p, 4), '(e^((r−q)Δt) − d)/(u − d)'), stat('Δt', fmt(bt.dt * 365, 2) + ' días'), stat(`Prima binomial ${am ? 'americana' : 'europea'}`, fmt(bt.price, 4)), stat('Black-Scholes', fmt(g.price, 4), `diferencia ${fmt(bt.price - g.price, 4)}`)].join('');
  if (bt.tree) {
    const rowsN = 2 * n + 1; let h = '<tbody>';
    for (let rI = 0; rI < rowsN; rI++) { h += '<tr>'; for (let i = 0; i <= n; i++) { const j = (rI - (n - i)) / 2; const node = Number.isInteger(j) && j >= 0 && j <= i ? bt.tree[i][j] : null; h += `<td>${node ? `<span class="node ${node.ex ? 'ex' : ''}">${fmt(node.S, 2)}<br><b>${fmt(node.V, 3)}</b></span>` : ''}</td>`; } h += '</tr>'; }
    $('#t-tree').innerHTML = `<thead><tr>${Array.from({ length: n + 1 }, (_, i) => `<th style="text-align:center">t${i}</th>`).join('')}</tr></thead>` + h + '</tbody>';
  } else $('#t-tree').innerHTML = `<tbody><tr><td class="t muted">Con ${n} pasos el árbol es demasiado grande para dibujarlo; se muestran solo los resultados.</td></tr></tbody>`;
  const ns = [], bv = [], bav = []; for (let k = 1; k <= 120; k += (k < 20 ? 1 : 4)) { ns.push(k); bv.push(Q.binomial(p.spot, K, p.T, p.r, p.q, p.v, k, type, false).price); bav.push(Q.binomial(p.spot, K, p.T, p.r, p.q, p.v, k, type, true).price); }
  const co = baseOpts(c, { scales: axes(c, { x: { title: { display: true, text: 'pasos', color: c.muted } } }) }); co.plugins.hlines = { lines: [{ y: g.price, color: c.ochre, label: `BS ${fmt(g.price, 4)}` }] };
  mkChart('c-conv', { type: 'line', data: { labels: ns, datasets: [lineDS('Binomial europea', bv, c.accent), lineDS('Binomial americana', bav, c.s3, { borderDash: [4, 3] })] }, options: co });
}
function autoCalibrate() {
  const p = P(), K = parseFloat($('#o-K').value) || p.spot, type = $('#o-type').value, mkt = parseFloat($('#o-mkt').value);
  if (isNum(mkt)) { const iv = Q.impliedVol(mkt, p.spot, K, p.T, p.r, p.q, type); if (isNum(iv)) { $('#p-volm').value = 'iv'; $('#p-vol').value = (iv * 100).toFixed(2); $('#p-vol-h').textContent = 'implícita calibrada'; toast(`σ implícita calibrada: ${pct(iv, 2)}`); } else toast('La prima capturada está por debajo del valor intrínseco; revisa strike y tipo.'); }
  else if (S.smile && !S.smile.ex) { const ivs = S.smile.rows.map((r) => Q.impliedVol(r.prem, p.spot, r.K, p.T, p.r, p.q, r.t)).filter(isNum); const atm = S.smile.rows.reduce((a, b) => (Math.abs(b.K - p.spot) < Math.abs(a.K - p.spot) ? b : a)); const v = Q.impliedVol(atm.prem, p.spot, atm.K, p.T, p.r, p.q, atm.t); if (isNum(v)) { $('#p-volm').value = 'iv'; $('#p-vol').value = (v * 100).toFixed(2); $('#p-vol-h').textContent = 'implícita ATM de la sonrisa'; toast(`σ calibrada a la sonrisa (ATM): ${pct(v, 2)} · ${ivs.length} strikes`); } }
  else { $('#p-volm').value = 'ewma'; recalcVol(); toast('σ calibrada con EWMA (sin primas de mercado capturadas)'); }
  render();
}
