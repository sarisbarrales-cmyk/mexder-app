/* ===================== UI 3: coberturas, operación, decisión, reportes ===================== */
const STRATS = [
  { id: 'ls', name: 'Straddle largo', tag: 'Alta volatilidad', view: 'vol+', desc: 'Compra de call y put al mismo strike. Gana con movimientos fuertes en cualquier dirección; la pérdida se limita a las primas pagadas.' },
  { id: 'ss', name: 'Straddle corto', tag: 'Lateral', view: 'flat', desc: 'Venta de call y put al mismo strike. Cobra ambas primas y gana si el precio se queda cerca del strike; pérdida potencial ilimitada.' },
  { id: 'lg', name: 'Strangle largo', tag: 'Alta volatilidad', view: 'vol+', desc: 'Compra de put K₁ y call K₃ fuera del dinero. Más barato que el straddle, pero necesita un movimiento mayor para ganar.' },
  { id: 'sg', name: 'Strangle corto', tag: 'Lateral', view: 'flat', desc: 'Venta de put K₁ y call K₃ fuera del dinero. Rango de ganancia más amplio que el straddle corto, con riesgo ilimitado en las colas.' },
  { id: 'bc', name: 'Mariposa con calls', tag: 'Lateral', view: 'flat', desc: 'Compra call K₁, vende 2 calls K₂ y compra call K₃. Ganancia máxima si el precio cierra en K₂; riesgo limitado al costo neto.' },
  { id: 'bp', name: 'Mariposa con puts', tag: 'Lateral', view: 'flat', desc: 'Compra put K₁, vende 2 puts K₂ y compra put K₃. Mismo perfil que la mariposa con calls, armada con puts.' },
  { id: 'cap', name: 'Cap (techo)', tag: 'Bajista protegida', view: 'bear', desc: 'Venta de futuro más compra de call K₃. Fija un precio máximo a la pérdida si el subyacente sube: es el techo de quien está corto o debe comprar después.' },
  { id: 'floor', name: 'Floor (piso)', tag: 'Alcista protegida', view: 'bull', desc: 'Compra de futuro más compra de put K₁. Garantiza un precio mínimo de venta y conserva la ganancia al alza, a cambio de la prima.' },
  { id: 'collar', name: 'Collar', tag: 'Alcista moderada', view: 'bull', desc: 'Compra de futuro, compra de put K₁ y venta de call K₃. La prima cobrada financia el piso a cambio de ceder ganancias arriba de K₃.' },
  { id: 'fsl', name: 'Compra de futuro con stop loss', tag: 'Alcista con stop', view: 'bull', desc: 'Futuro largo con orden de stop abajo del precio pactado. Limita la pérdida si el precio toca el stop, con riesgo de ejecución con brecha.' },
  { id: 'vsl', name: 'Venta de futuro con stop loss', tag: 'Bajista con stop', view: 'bear', desc: 'Futuro corto con orden de stop arriba del precio pactado. Limita la pérdida si el precio sube hasta el stop.' },
];
const EXTRA = { fl: { id: 'fl', name: 'Futuro largo sin cobertura', tag: 'Alcista', view: 'bull' }, fs: { id: 'fs', name: 'Futuro corto sin cobertura', tag: 'Bajista', view: 'bear' } };
S.strat = store.get('strat', 'collar');

function strikes(p) {
  const w = (parseFloat($('#s-w').value) || 5) / 100;
  const k1 = parseFloat($('#s-k1').value), k2 = parseFloat($('#s-k2').value), k3 = parseFloat($('#s-k3').value);
  return { K1: isNum(k1) ? k1 : roundTick(p.spot * (1 - w), p.spot), K2: isNum(k2) ? k2 : roundTick(p.spot, p.spot), K3: isNum(k3) ? k3 : roundTick(p.spot * (1 + w), p.spot) };
}
function resetStrikes() { const p = P(), w = (parseFloat($('#s-w').value) || 5) / 100; $('#s-k1').value = roundTick(p.spot * (1 - w), p.spot); $('#s-k2').value = roundTick(p.spot, p.spot); $('#s-k3').value = roundTick(p.spot * (1 + w), p.spot); }
function buildLegs(id, p, K) {
  const n = p.n, pr = (k, t) => Q.bs(p.spot, k, p.T, p.r, p.q, p.v, t).price, F = p.F, sl = (parseFloat($('#s-sl').value) || 5) / 100;
  const C = (q, k) => ({ k: 'C', q, K: k, prem: pr(k, 'C') }), Pt = (q, k) => ({ k: 'P', q, K: k, prem: pr(k, 'P') }), Fu = (q) => ({ k: 'F', q, K: F, prem: 0 });
  switch (id) {
    case 'ls': return [C(n, K.K2), Pt(n, K.K2)];
    case 'ss': return [C(-n, K.K2), Pt(-n, K.K2)];
    case 'lg': return [Pt(n, K.K1), C(n, K.K3)];
    case 'sg': return [Pt(-n, K.K1), C(-n, K.K3)];
    case 'bc': return [C(n, K.K1), C(-2 * n, K.K2), C(n, K.K3)];
    case 'bp': return [Pt(n, K.K1), Pt(-2 * n, K.K2), Pt(n, K.K3)];
    case 'cap': return [Fu(-n), C(n, K.K3)];
    case 'floor': return [Fu(n), Pt(n, K.K1)];
    case 'collar': return [Fu(n), Pt(n, K.K1), C(-n, K.K3)];
    case 'fsl': return [{ k: 'FSL', q: n, K: F, prem: 0, stop: F * (1 - sl) }];
    case 'vsl': return [{ k: 'FSL', q: -n, K: F, prem: 0, stop: F * (1 + sl) }];
    case 'fl': return [Fu(n)];
    case 'fs': return [Fu(-n)];
  }
  return [];
}
function legName(L) { const pos = L.q > 0 ? 'Compra' : 'Venta'; return L.k === 'C' ? `${pos} call` : L.k === 'P' ? `${pos} put` : L.k === 'F' ? `${pos} futuro` : `${pos} futuro con stop`; }
function marginEst(legs, p) {
  // AIM estimada: futuros por VaR; opciones vendidas: prima + AIM del subyacente × |delta| (mín. 30%)
  const aimF = p.size * p.F * (p.v / Math.sqrt(252)) * Q.ninv(0.99) * Math.sqrt(2);
  let netF = 0, m = 0;
  for (const L of legs) {
    if (L.k === 'F' || L.k === 'FSL') netF += L.q;
    else if (L.q < 0) { const d = Math.abs(Q.bs(p.spot, L.K, p.T, p.r, p.q, p.v, L.k).delta); m += Math.abs(L.q) * (L.prem * p.size + aimF * Math.max(0.3, d)); }
  }
  return m + Math.abs(netF) * aimF;
}
function cfgPayoff(sets, p, c, lines = []) {
  const xs = []; for (let i = 0; i <= 160; i++) xs.push(p.spot * (0.7 + 0.6 * i / 160));
  const pal = [c.accent, c.ochre, c.s3, c.s4, c.up, c.down];
  const ds = [];
  sets.forEach((s, k) => { ds.push(lineDS(s.label, xs.map((x) => ({ x, y: Q.payoff(s.legs, x, p.mult) })), s.color || pal[k % pal.length], { borderWidth: 2 })); if (s.today) ds.push(lineDS(s.label + ' · hoy', xs.map((x) => ({ x, y: Q.valueAt(s.legs, x, p.T, p.r, p.q, p.v, p.mult) })), s.color || pal[k % pal.length], { borderDash: [5, 4], borderWidth: 1.4 })); });
  const o = baseOpts(c, { scales: axes(c, { x: { type: 'linear', ticks: { color: c.muted, callback: (v) => fmt(v, 0) } }, y: { ticks: { color: c.muted, callback: (v) => big(v) } } }) });
  o.plugins.hlines = { lines: [{ y: 0, color: c.muted, dash: [] }, { x: p.spot, color: c.muted, label: 'spot' }, ...lines] };
  o.plugins.tooltip.callbacks.label = (it) => `${it.dataset.label}: ${money(it.parsed.y, 0)}`; o.plugins.tooltip.callbacks.title = (it) => 'Subyacente ' + fmt(it[0].parsed.x);
  return { type: 'line', data: { datasets: ds }, options: o };
}
let PATHS = null;
function sharedPaths(p, mu) { const key = [p.spot, p.T, mu, p.v, S.symbol].join('|'); if (PATHS && PATHS.key === key) return PATHS.paths; const steps = Math.max(10, Math.min(60, Math.round(p.days * 252 / 365))); PATHS = { key, paths: Q.simulate(p.spot, p.T, mu, p.v, 4000, steps, 12345) }; return PATHS.paths; }
function stratEval(st, p, K, mu) {
  const legs = buildLegs(st.id, p, K); const m = Q.strategyMetrics(legs, p.spot, p.mult); const mc = Q.mcStats(legs, sharedPaths(p, mu), p.mult);
  return { ...st, legs, ...m, ...mc, net: Q.netPremium(legs, p.mult), margin: marginEst(legs, p) };
}
function renderCob() {
  const c = COL(), p = P();
  if (!$('#s-k2').value) resetStrikes();
  $('#s-pick').innerHTML = STRATS.map((s) => `<button class="btn sm ${s.id === S.strat ? 'primary' : ''}" role="tab" aria-selected="${s.id === S.strat}" data-s="${s.id}">${s.name}</button>`).join('');
  $$('#s-pick button').forEach((b) => b.addEventListener('click', () => { S.strat = b.dataset.s; store.set('strat', S.strat); renderCob(); }));
  const st = STRATS.find((s) => s.id === S.strat) || STRATS[0], K = strikes(p), e = stratEval(st, p, K, p.r - p.q);
  $('#s-title').innerHTML = `${st.name} <span class="chip info plain">${st.tag}</span>`; $('#s-desc').textContent = st.desc;
  const stopL = e.legs.find((l) => l.stop);
  mkChart('c-spay', cfgPayoff([{ label: st.name, legs: e.legs, today: true }], p, c, [...e.breakevens.map((b) => ({ x: b, color: c.ochre, label: 'eq. ' + fmt(b) })), ...(stopL ? [{ x: stopL.stop, color: c.down, label: 'stop ' + fmt(stopL.stop) }] : [])]));
  $('#s-stats').innerHTML = [stat(e.net >= 0 ? 'Prima neta pagada' : 'Prima neta cobrada', money(Math.abs(e.net), 0), '', e.net > 0 ? 'down' : e.net < 0 ? 'up' : ''), stat('Ganancia máxima', money(e.maxGain, 0), '', 'up'), stat('Pérdida máxima', money(e.maxLoss, 0), stopL ? 'sin brecha en el stop' : '', 'down'),
    stat('Equilibrio', e.breakevens.length ? e.breakevens.map((b) => fmt(b)).join(' · ') : '—'), stat('Prob. de ganancia', pct(e.pWin, 1), '4,000 trayectorias'), stat('Valor esperado', money(e.ev, 0), 'neutral al riesgo', e.ev >= 0 ? 'up' : 'down'),
    stat('VaR 95%', money(e.var95, 0), '', 'down'), stat('AIM estimada', money(e.margin, 0), pct(e.margin / p.cap, 1) + ' del capital')].join('');
  table('#t-legs', ['Pata', 'Instrumento', 'Strike / precio', 'Prima por acción', 'Contratos', 'Flujo inicial'], e.legs.map((L, i) => [String(i + 1), { v: legName(L), c: 't' }, fmt(L.K) + (L.stop ? ` · stop ${fmt(L.stop)}` : ''), L.prem ? fmt(L.prem, 4) : '—', Math.abs(L.q), { v: L.prem ? money(-L.q * L.prem * p.size, 0) : '—', c: cls(-L.q * L.prem) }]));
}
// ---------- Bitácoras ----------
S.trades = store.get('trades', { fut: [], opt: [] });
const saveTrades = () => store.set('trades', S.trades);
const today = () => new Date().toISOString().slice(0, 10);
const elapsed = (d) => Math.max(0, Math.round((Date.now() - new Date(d + 'T12:00:00').getTime()) / 864e5));
function bookStrategy() {
  const p = P(), st = STRATS.find((s) => s.id === S.strat), legs = buildLegs(st.id, p, strikes(p)); let nf = 0, no = 0;
  for (const L of legs) {
    if (L.k === 'C' || L.k === 'P') { S.trades.opt.push({ id: Date.now() + Math.random(), sym: S.symbol, type: L.k, side: Math.sign(L.q), K: L.K, prem: +L.prem.toFixed(4), n: Math.abs(L.q), days: p.days, date: today(), tag: st.name }); no++; }
    else { S.trades.fut.push({ id: Date.now() + Math.random(), sym: S.symbol, side: Math.sign(L.q), n: Math.abs(L.q), px: +L.K.toFixed(4), days: p.days, date: today(), sl: L.stop ? +L.stop.toFixed(2) : null, tp: null, tag: st.name }); nf++; }
  }
  saveTrades(); $('#s-bookmsg').textContent = `Registradas ${nf} patas de futuros y ${no} de opciones.`;
}
function renderOpf() {
  const p = P(), aimC = aimPerContract(p, p.F), rows = S.trades.fut.filter((t) => t.sym === S.symbol);
  if (!$('#of-px').value) $('#of-px').value = p.F.toFixed(2);
  let tot = 0, aim = 0, nom = 0;
  const body = rows.map((t) => {
    const tau = Math.max(0, t.days - elapsed(t.date)) / 365, Fn = p.spot * Math.exp((p.r - p.q) * tau), pl = t.side * (Fn - t.px) * p.size * t.n;
    const hitSL = t.sl && (t.side > 0 ? p.spot <= t.sl : p.spot >= t.sl), hitTP = t.tp && (t.side > 0 ? p.spot >= t.tp : p.spot <= t.tp);
    tot += pl; aim += aimC * t.n; nom += Fn * p.size * t.n;
    const state = hitSL ? '<span class="chip bear">Stop alcanzado</span>' : hitTP ? '<span class="chip bull">Objetivo alcanzado</span>' : tau === 0 ? '<span class="chip flat">Vencido</span>' : '<span class="chip info">Abierta</span>';
    return [t.date, { v: t.side > 0 ? 'Compra' : 'Venta', c: 't' }, t.n, fmt(t.px), fmt(Fn), Math.round(tau * 365) + ' d', t.sl ? fmt(t.sl) : '—', { v: money(pl, 0), c: cls(pl) }, money(aimC * t.n, 0), { v: state, c: 't' }, { v: `<button class="btn sm danger" data-del="${t.id}">Cerrar</button>`, c: 't' }];
  });
  table('#t-of', ['Fecha', 'Postura', 'Contratos', 'Pactado', 'Futuro hoy', 'Plazo rem.', 'Stop', 'Resultado', 'AIM', 'Estado', ''], body.length ? body : [['Sin posiciones para ' + esc(S.symbol), '', '', '', '', '', '', '', '', '', '']]);
  $$('#t-of [data-del]').forEach((b) => b.addEventListener('click', () => { S.trades.fut = S.trades.fut.filter((t) => String(t.id) !== b.dataset.del); saveTrades(); renderOpf(); }));
  $('#of-stats').innerHTML = [stat('Posiciones', rows.length), stat('Resultado a mercado', money(tot, 0), '', tot >= 0 ? 'up' : 'down'), stat('AIM requerida', money(aim, 0), pct(aim / p.cap, 1) + ' del capital'), stat('Nocional', money(nom, 0))].join('');
}
function renderOpo() {
  const c = COL(), p = P(), rows = S.trades.opt.filter((t) => t.sym === S.symbol);
  let tot = 0, D = 0, G = 0, V = 0, Th = 0, prem = 0; const legs = [];
  const body = rows.map((t) => {
    const tau = Math.max(0, t.days - elapsed(t.date)) / 365, g = Q.bs(p.spot, t.K, tau, p.r, p.q, p.v, t.type), m = t.side * p.size * t.n;
    const pl = (g.price - t.prem) * m; tot += pl; D += g.delta * m; G += g.gamma * m; V += g.vega * m; Th += g.theta * m; prem += t.prem * m; legs.push({ k: t.type, q: t.side * t.n, K: t.K, prem: t.prem });
    return [t.date, { v: `${t.side > 0 ? 'Larga' : 'Corta'} ${t.type === 'C' ? 'call' : 'put'}`, c: 't' }, fmt(t.K), t.n, fmt(t.prem, 4), fmt(g.price, 4), Math.round(tau * 365) + ' d', fmt(g.delta * t.side, 3), { v: money(pl, 0), c: cls(pl) }, { v: `<button class="btn sm danger" data-del="${t.id}">Cerrar</button>`, c: 't' }];
  });
  table('#t-oo', ['Fecha', 'Posición', 'Strike', 'Contratos', 'Prima', 'Valor hoy', 'Plazo rem.', 'Delta', 'Resultado', ''], body.length ? body : [['Sin posiciones para ' + esc(S.symbol), '', '', '', '', '', '', '', '', '']]);
  $$('#t-oo [data-del]').forEach((b) => b.addEventListener('click', () => { S.trades.opt = S.trades.opt.filter((t) => String(t.id) !== b.dataset.del); saveTrades(); renderOpo(); }));
  $('#oo-stats').innerHTML = [stat('Posiciones', rows.length), stat('Resultado a mercado', money(tot, 0), '', tot >= 0 ? 'up' : 'down'), stat(prem >= 0 ? 'Primas pagadas' : 'Primas cobradas', money(Math.abs(prem), 0)), stat('Delta del libro', fmt(D, 0) + ' acc.'), stat('Gamma', fmt(G, 2)), stat('Vega', money(V, 0), 'por punto de σ'), stat('Theta', money(Th, 0), 'por día', Th >= 0 ? 'up' : 'down')].join('');
  if (legs.length) mkChart('c-oo', cfgPayoff([{ label: 'Libro de opciones', legs, today: true }], { ...p, mult: p.size }, c));
  else if (CH['c-oo']) { CH['c-oo'].destroy(); delete CH['c-oo']; }
}

// ---------- 11 Comparativas ----------
function driftFor(mode, p) {
  if (mode === 'hist') return histDrift();
  if (mode === 'view') { const sg = suggestedSide(); const tilt = sg.view === 'Alcista' ? 0.35 : sg.view === 'Bajista' ? -0.35 : 0; return p.r - p.q + tilt * p.v; }
  return p.r - p.q;
}
const RISK = { cons: { lam: 2.2, unl: 1.6, tol: 0.05 }, mod: { lam: 1.1, unl: 0.6, tol: 0.12 }, agr: { lam: 0.45, unl: 0.15, tol: 0.25 } };
function compareAll(p, mode) {
  const K = strikes(p), mu = driftFor(mode, p), sg = suggestedSide(), ve = volEstimates();
  const volReg = ve.ewma > ve.hist * 1.1 ? 'up' : ve.ewma < ve.hist * 0.9 ? 'down' : 'flat';
  const list = STRATS.map((s) => stratEval(s, p, K, mu));
  const scale = p.size * p.n * p.spot * 0.05;
  for (const e of list) {
    e.score = {};
    let fit = 0;
    if (sg.view === 'Alcista' && e.view === 'bull') fit += 0.6; if (sg.view === 'Bajista' && e.view === 'bear') fit += 0.6; if (sg.view === 'Lateral' && e.view === 'flat') fit += 0.5;
    if ((sg.view === 'Alcista' && e.view === 'bear') || (sg.view === 'Bajista' && e.view === 'bull')) fit -= 0.6;
    if (volReg === 'up' && e.view === 'vol+') fit += 0.4; if (volReg === 'down' && e.view === 'flat') fit += 0.3; if (sg.view !== 'Lateral' && e.view === 'vol+') fit += 0.15;
    e.fit = fit;
    for (const [k, R] of Object.entries(RISK)) {
      const unl = e.maxLoss === -Infinity ? 1 : 0;
      e.score[k] = e.ev / scale + 2.2 * (e.pWin - 0.5) - R.lam * e.cvar / scale * 0.35 - R.unl * unl + fit;
    }
  }
  return { list, mu, sg, volReg, ve };
}
function renderComp() {
  const c = COL(), p = P(), mode = $('#c-drift').value, res = compareAll(p, mode), prof = p.prof;
  const sorted = [...res.list].sort((a, b) => b.score[prof] - a.score[prof]), best = sorted[0];
  const volTxt = { up: 'la volatilidad reciente (EWMA) supera a la histórica', down: 'la volatilidad reciente está por debajo de la histórica', flat: 'la volatilidad reciente está en línea con la histórica' }[res.volReg];
  $('#c-rec').innerHTML = `<h4>Sugerencia para perfil ${PROF[prof].toLowerCase()}: ${best.name}</h4>
    <p class="small">Lectura técnica <b>${res.sg.view.toLowerCase()}</b> (puntaje ${fmt(res.sg.score, 1)}) y ${volTxt} (${pct(res.ve.ewma, 1)} vs ${pct(res.ve.hist, 1)}). ${best.name}: probabilidad de ganancia ${pct(best.pWin, 1)}, pérdida máxima ${money(best.maxLoss, 0)}, valor esperado ${money(best.ev, 0)} con el supuesto «${$('#c-drift').selectedOptions[0].textContent}».</p>
    <p class="small" style="margin-top:6px">Alternativas: ${sorted.slice(1, 3).map((s) => `<b>${s.name}</b> (P. ganancia ${pct(s.pWin, 0)})`).join(' y ')}. Futuros: postura <b>${res.sg.side > 0 ? 'compra' : 'venta'}</b>; contratos ${prof === 'cons' ? 'con stop loss o cobertura con opciones' : prof === 'mod' ? 'con stop loss' : 'con o sin stop según tolerancia'}.</p>`;
  const rows = sorted.map((e) => Object.assign([{ v: e.name, c: 't' }, { v: e.tag, c: 't' }, { v: money(-e.net, 0), c: cls(-e.net) }, money(e.maxGain, 0), { v: money(e.maxLoss, 0), c: 'neg' }, e.breakevens.map((b) => fmt(b)).join(' · ') || '—', pct(e.pWin, 1), { v: money(e.ev, 0), c: cls(e.ev) }, money(e.var95, 0), money(e.margin, 0), fmt(e.score.cons, 2), fmt(e.score.mod, 2), fmt(e.score.agr, 2)], { _cls: e === best ? 'hl' : '' }));
  table('#t-comp', ['Estrategia', 'Visión', 'Prima neta', 'Gan. máx.', 'Pérd. máx.', 'Equilibrio', 'P(ganancia)', 'Valor esperado', 'VaR 95%', 'AIM est.', 'Conserv.', 'Moderado', 'Agresivo'], rows);
  const pal = [c.accent, c.ochre, c.s3, c.s4, c.up, c.down, c.muted];
  const cap = p.cap;
  const bo = baseOpts(c, { interaction: { mode: 'nearest', intersect: true }, scales: axes(c, { x: { type: 'linear', title: { display: true, text: 'riesgo: pérdida máxima o CVaR × 2 (% del capital)', color: c.muted }, ticks: { color: c.muted, callback: (v) => fmt(v, 0) + '%' } }, y: { min: 0, max: 100, title: { display: true, text: 'P(ganancia) %', color: c.muted }, ticks: { color: c.muted, callback: (v) => v + '%' } } }) });
  bo.plugins.legend.display = false; bo.plugins.tooltip.callbacks.label = (it) => `${it.raw.n}: riesgo ${fmt(it.parsed.x, 1)}% · P ${fmt(it.parsed.y, 1)}%`;
  mkChart('c-comp', { type: 'scatter', data: { datasets: [{ label: 'Estrategias', data: res.list.map((e) => ({ x: (isFinite(e.maxLoss) ? -e.maxLoss : e.cvar * 2) / cap * 100, y: e.pWin * 100, n: e.name })), backgroundColor: res.list.map((e) => (e === best ? c.ochre : alpha(c.accent, 0.75))), pointRadius: res.list.map((e) => (e === best ? 8 : 5.5)) }] }, options: bo, plugins: [{ id: 'lbl', afterDatasetsDraw(ch) { const { ctx } = ch; ctx.save(); ctx.font = '10.5px Archivo, sans-serif'; ctx.fillStyle = c.ink; const top = new Set(sorted.slice(0, 5)); ch.getDatasetMeta(0).data.forEach((pt, i) => top.has(res.list[i]) && ctx.fillText(res.list[i].name.replace(' con stop loss', ' + stop'), pt.x + 7, pt.y - 6)); ctx.restore(); } }] });
  mkChart('c-comp2', cfgPayoff(sorted.slice(0, 4).map((e, i) => ({ label: e.name, legs: e.legs, color: pal[i] })), p, c));
  S.lastComp = { sorted, best, res };
}

// ---------- 12 Escenarios ----------
S.scen = store.get('scen', null) || [
  { n: 'Alcista fuerte', z: 2, dv: -10 }, { n: 'Alcista moderado', z: 1, dv: -5 }, { n: 'Base / lateral', z: 0, dv: 0 },
  { n: 'Bajista moderado', z: -1, dv: 10 }, { n: 'Bajista fuerte', z: -2, dv: 25 }, { n: 'Estrés / crisis', z: -3, dv: 60 },
];
function profileMix(prof) {
  const sg = suggestedSide(), dir = sg.side > 0;
  return { cons: ['floor', 'collar', dir ? 'fsl' : 'vsl'], mod: ['collar', 'bc', dir ? 'fsl' : 'vsl', 'lg'], agr: [dir ? 'fl' : 'fs', 'ls', 'sg', dir ? 'fsl' : 'vsl'] }[prof];
}
function scenarioTable(prof, p, hz) {
  const K = strikes(p), ids = profileMix(prof), strats = ids.map((id) => STRATS.find((s) => s.id === id) || EXTRA[id]);
  const legsets = strats.map((s) => buildLegs(s.id, p, K));
  const tau = p.T * hz, rem = p.T - tau;
  const zs = S.scen.map((s) => s.z), order = [...zs].sort((a, b) => a - b);
  const prob = (z) => { const i = order.indexOf(z); const lo = i === 0 ? -Infinity : (order[i - 1] + z) / 2, hi = i === order.length - 1 ? Infinity : (order[i + 1] + z) / 2; return Q.N(hi) - Q.N(lo); };
  const rows = S.scen.map((sc) => {
    const St = p.spot * Math.exp((p.r - p.q - 0.5 * p.v * p.v) * tau + sc.z * p.v * Math.sqrt(tau)), vol = Math.max(0.02, p.v * (1 + sc.dv / 100));
    const pls = legsets.map((L) => (rem <= 1e-9 ? Q.payoff(L, St, p.mult) : Q.valueAt(L, St, rem, p.r, p.q, vol, p.mult)));
    const total = pls.reduce((a, b) => a + b, 0);
    return { sc, St, pls, total, prob: prob(sc.z) };
  });
  return { strats, rows, tol: RISK[prof].tol };
}
function renderEsc() {
  const c = COL(), p = P(), hz = +$('#e-hz').value;
  $('#t-escdef').innerHTML = `<thead><tr><th>Escenario</th><th>Movimiento (σ)</th><th>Precio implícito</th><th>Cambio en σ (%)</th><th>Probabilidad</th></tr></thead><tbody>${S.scen.map((s, i) => { const tau = p.T * hz, St = p.spot * Math.exp((p.r - p.q - 0.5 * p.v * p.v) * tau + s.z * p.v * Math.sqrt(tau)); return `<tr><td class="t"><input type="text" value="${esc(s.n)}" data-i="${i}" data-f="n" class="esc-in" style="width:170px;height:26px" aria-label="Nombre escenario ${i + 1}"></td><td><input type="number" step="0.25" value="${s.z}" data-i="${i}" data-f="z" class="esc-in" style="width:80px;height:26px" aria-label="Movimiento escenario ${i + 1}"></td><td>${fmt(St)} (${pct(St / p.spot - 1, 1)})</td><td><input type="number" step="5" value="${s.dv}" data-i="${i}" data-f="dv" class="esc-in" style="width:80px;height:26px" aria-label="Cambio de volatilidad escenario ${i + 1}"></td><td>${pct(scenarioTable('mod', p, hz).rows[i].prob, 1)}</td></tr>`; }).join('')}</tbody>`;
  $$('.esc-in').forEach((el) => el.addEventListener('change', () => { const s = S.scen[+el.dataset.i]; s[el.dataset.f] = el.dataset.f === 'n' ? el.value : parseFloat(el.value) || 0; store.set('scen', S.scen); renderEsc(); }));
  const box = $('#e-profiles'); box.innerHTML = '';
  for (const prof of ['cons', 'mod', 'agr']) {
    const t = scenarioTable(prof, p, hz), worst = Math.min(...t.rows.map((r) => r.total)), evS = t.rows.reduce((s, r) => s + r.total * r.prob, 0);
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<h3>Perfil ${PROF[prof].toLowerCase()} <span class="sub">${t.strats.map((s) => s.name).join(' + ')} · tolerancia de pérdida ${pct(t.tol, 0)} del capital</span>${prof === p.prof ? '<span class="chip info plain">perfil seleccionado</span>' : ''}</h3>
      <div class="stats" style="margin-bottom:10px">${stat('Peor escenario', money(worst, 0), pct(worst / p.cap, 1) + ' del capital', worst < -t.tol * p.cap ? 'down' : '')}${stat('Resultado ponderado', money(evS, 0), 'por probabilidad del escenario', evS >= 0 ? 'up' : 'down')}${stat('Escenarios fuera de tolerancia', t.rows.filter((r) => r.total < -t.tol * p.cap).length + ' de ' + t.rows.length)}</div>
      <div class="tbl-wrap"><table id="t-esc-${prof}"></table></div><div class="chart" style="margin-top:12px;height:240px"><canvas id="c-esc-${prof}"></canvas></div>`;
    box.appendChild(card);
    table(`#t-esc-${prof}`, ['Escenario', 'Precio', ...t.strats.map((s) => s.name.replace(' sin cobertura', '').replace(' con stop loss', ' + stop')), 'Total', '% capital', 'Estado'], t.rows.map((r) => [r.sc.n, fmt(r.St), ...r.pls.map((x) => ({ v: money(x, 0), c: cls(x) })), { v: money(r.total, 0), c: cls(r.total) + (r.total >= 0 ? ' heat-pos' : ' heat-neg') }, pct(r.total / p.cap, 1), { v: r.total < -t.tol * p.cap ? '<span class="chip bear">Excede</span>' : '<span class="chip bull">Dentro</span>', c: 't' }]));
    const o = baseOpts(c, { scales: axes(c, { y: { ticks: { color: c.muted, callback: (v) => big(v) } } }) }); o.plugins.hlines = { lines: [{ y: -t.tol * p.cap, color: c.down, label: 'tolerancia' }] };
    o.plugins.tooltip.callbacks.label = (it) => `${it.dataset.label}: ${money(it.parsed.y, 0)}`;
    mkChart(`c-esc-${prof}`, { type: 'bar', data: { labels: t.rows.map((r) => r.sc.n), datasets: [{ label: 'Total del perfil', data: t.rows.map((r) => r.total), backgroundColor: t.rows.map((r) => (r.total >= 0 ? c.up : c.down)) }] }, options: o });
  }
}

// ---------- 13 Reportes ----------
const REP = [['res', 'Resumen ejecutivo'], ['hist', 'Data histórica'], ['tec', 'Indicadores técnicos'], ['fin', 'Estados financieros y ratios'], ['riesgo', 'Riesgos y betas'], ['chart', 'Figuras chartistas'], ['fut', 'Futuros'], ['opc', 'Opciones y griegas'], ['cob', 'Estrategias comparadas'], ['esc', 'Escenarios por perfil'], ['ops', 'Bitácora de operaciones']];
function renderRep() {
  if (!$('#rep-checks').children.length) $('#rep-checks').innerHTML = REP.map(([k, l]) => `<label><input type="checkbox" id="rc-${k}" checked> ${l}</label>`).join('');
  const s = execSummary();
  $('#rep-sum').innerHTML = `<div class="stats">${s.map(([l, v]) => stat(l, v)).join('')}</div>`;
  $('#rep-print').hidden = window.self !== window.top;
}
function execSummary() {
  const p = P(), B = bars(), tr = technicalRead(B), rm = riskMetrics(), bg = betaFor('D', 1, false), x = futCtx(), comp = compareAll(p, $('#c-drift').value);
  const best = [...comp.list].sort((a, b) => b.score[p.prof] - a.score[p.prof])[0];
  return [['Emisora', `${S.name} (${S.symbol})`], ['Fuente de datos', S.src === 'csv' ? 'CSV del usuario' : S.live ? 'Yahoo Finance' : 'Demostración (simulado)'], ['Fecha de corte', S.all[S.all.length - 1]?.d || ''], ['Ciclo', cycleName()], ['Precio spot', '$' + fmt(p.spot)],
    ['Lectura técnica', `${tr.view} (${fmt(tr.score, 1)})`], ['Tendencia primaria / secundaria', `${tr.tr.primary} / ${tr.tr.secondary}`], ['RSI 14', fmt(tr.r14[tr.r14.length - 1], 1)], ['Beta general vs IPC', fmt(bg.beta, 2)], ['Volatilidad calibrada', pct(p.v, 1)],
    ['VaR 95% por barra', pct(rm.var95)], ['Futuro teórico', `$${fmt(p.F)} · ${p.termLabel}`], ['Postura sugerida', x.side > 0 ? 'Compra' : 'Venta'], ['AIM total', money(x.aimT, 0)], ['Estrategia sugerida', `${best.name} (${PROF[p.prof]})`]];
}
function aoaTable(sel, raw) { const t = $(sel); if (!t) return []; return [...t.querySelectorAll('tr')].map((tr) => [...tr.children].map((td) => { const inp = td.querySelector('input'); const v = inp ? inp.value : td.textContent.trim(); if (raw) return v; const n = parseNumES(v); return n != null ? n : v; })); }
const PDFMAP = { 'σ': 'sigma', 'Σ': 'sigma', 'Δ': 'D', 'λ': 'lambda', '√': 'raiz', '−': '-', '×': 'x', '₁': '1', '₂': '2', '₃': '3', '→': '->', '·': '-', '²': '2', 'ᵢ': 'i', '≈': '~', '…': '...', '“': '"', '”': '"', '«': '"', '»': '"' };
const pdfSafe = (s) => String(s ?? '').replace(/[^\x00-\xFF]/g, (ch) => PDFMAP[ch] ?? '');
function parseNumES(v) { if (typeof v !== 'string') return null; const s = v.replace(/[$\s×]/g, '').replace('−', '-'); if (!/^-?[\d,]+(\.\d+)?%?$/.test(s)) return null; const n = parseFloat(s.replace(/,/g, '')); return s.endsWith('%') ? n / 100 : n; }
function ensureRendered(views) { const cur = S.view; for (const v of views) { showView(v, true); } showView(cur); }
async function saveFile(filename, blob) {
  try { if (window.claude && window.claude.use) { const dl = await window.claude.use('downloads'); if (dl) { await dl.save({ filename, data: blob }); return 'saved'; } } }
  catch (e) { if (e && e.code === 'declined') return 'declined'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return 'saved';
}
const on = (k) => { const el = $('#rc-' + k); return !el || el.checked; };
function fileBase() { return `MEXDER_${S.symbol.replace(/[^A-Z0-9]/gi, '')}_${today()}`; }
async function exportXLS() {
  if (!window.XLSX) { toast('No se cargó la librería de Excel. Revisa la conexión.'); return; }
  $('#rep-msg').textContent = 'Generando Excel…';
  ensureRendered(['hist', 'tec', 'riesgo', 'chart', 'fut', 'opc', 'cob', 'opf', 'opo', 'comp', 'esc']);
  const wb = XLSX.utils.book_new(), add = (name, aoa) => { if (aoa.length) { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = (aoa[0] || []).map((_, i) => ({ wch: Math.min(40, Math.max(10, ...aoa.map((r) => String(r[i] ?? '').length + 2))) })); XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); } };
  const p = P();
  if (on('res')) add('Resumen', [['MEXDER Derivados Lab · Reporte'], [], ...execSummary(), [], ['Parámetros'], ['Spot', p.spot], ['Tasa r', p.r], ['Dividendos q', p.q], ['Volatilidad σ', p.v], ['Plazo (días)', p.days], ['Acciones por contrato', p.size], ['Contratos', p.n], ['Capital', p.cap], ['Perfil', PROF[p.prof]]]);
  if (on('hist')) add('Histórico', [['Fecha', 'Apertura', 'Máximo', 'Mínimo', 'Cierre', 'Cierre ajustado', 'Volumen'], ...bars().map((b) => [b.d, b.o, b.h, b.l, b.c, b.ac, b.v])]);
  if (on('tec')) { const B = bars(), tr = technicalRead(B); add('Indicadores', [['Fecha', 'Cierre', 'RSI 9', 'RSI 14', 'RSI 25', 'ROC', 'Williams %R', '%K', '%D'], ...B.map((b, i) => [b.d, b.c, tr.r9[i], tr.r14[i], tr.r25[i], tr.roc[i], tr.wil[i], tr.st.K[i], tr.st.D[i]])]); add('Fibonacci y señales', [...aoaTable('#t-fibt'), [], ['Señal', 'Valor', 'Lectura', 'Puntaje'], ...tr.sig.map((s) => [s.name, s.val, s.txt, s.s])]); }
  if (on('fin')) { const A = finAnnual(); const mk = (def) => { const t = stmtTable(A, def, yr); return [t.head, ...t.body.map((r) => r.map((v, i) => (i ? parseNumES(v) ?? v : v)))]; }; if (A.length) { add('Resultados', mk(DEF_ER)); add('Balance', mk(DEF_BAL)); add('Flujos', mk(DEF_FLU)); add('Ratios', mk(DEF_RAT)); } add('Dividendos', [['Fecha', 'Monto'], ...S.divs.map((d) => [d.d, d.amount])]); }
  if (on('riesgo')) add('Riesgo y betas', [...aoaTable('#t-beta'), [], ...$$('#r-stats .stat').map((s) => [s.querySelector('.l').textContent, s.querySelector('.v').textContent, s.querySelector('.s')?.textContent || ''])]);
  if (on('chart')) add('Chartismo', [...aoaTable('#t-sr'), [], ['Figura', 'Sesgo', 'Estado', 'Postura', 'Objetivo', 'Stop'], ...detectFigures(bars().slice(-(+$('#ch-n').value || 180)), +$('#ch-k').value || 5).figs.map((f) => [f.name, f.bias, f.state, f.post, f.target ?? '', f.stop ?? ''])]);
  if (on('fut')) add('Futuros', [...$$('#f-stats .stat').map((s) => [s.querySelector('.l').textContent, s.querySelector('.v').textContent, s.querySelector('.s')?.textContent || '']), [], ...aoaTable('#t-fpl')]);
  if (on('opc')) add('Opciones', [...aoaTable('#t-cal'), [], ...$$('#o-stats .stat').map((s) => [s.querySelector('.l').textContent, s.querySelector('.v').textContent]), [], ...aoaTable('#t-greeks'), [], ...$$('#b-stats .stat').map((s) => [s.querySelector('.l').textContent, s.querySelector('.v').textContent])]);
  if (on('cob')) add('Estrategias', aoaTable('#t-comp'));
  if (on('esc')) { const rows = []; for (const pr of ['cons', 'mod', 'agr']) { rows.push([`Perfil ${PROF[pr]}`]); rows.push(...aoaTable(`#t-esc-${pr}`)); rows.push([]); } add('Escenarios', [...aoaTable('#t-escdef'), [], ...rows]); }
  if (on('ops')) add('Operaciones', [['Futuros'], ['Fecha', 'Emisora', 'Postura', 'Contratos', 'Precio', 'Días', 'Stop', 'Origen'], ...S.trades.fut.map((t) => [t.date, t.sym, t.side > 0 ? 'Compra' : 'Venta', t.n, t.px, t.days, t.sl ?? '', t.tag || '']), [], ['Opciones'], ['Fecha', 'Emisora', 'Tipo', 'Postura', 'Strike', 'Prima', 'Contratos', 'Días', 'Origen'], ...S.trades.opt.map((t) => [t.date, t.sym, t.type === 'C' ? 'Call' : 'Put', t.side > 0 ? 'Larga' : 'Corta', t.K, t.prem, t.n, t.days, t.tag || ''])]);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const r = await saveFile(fileBase() + '.xlsx', new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  $('#rep-msg').textContent = r === 'declined' ? 'Descarga cancelada.' : `Excel generado con ${wb.SheetNames.length} hojas.`;
}
function chartImage(cfg, w = 900, h = 360) {
  const box = document.createElement('div'); box.style.cssText = `position:fixed;left:-20000px;top:0;width:${w}px;height:${h}px`; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; box.appendChild(cv); document.body.appendChild(box);
  cfg.options = Object.assign({}, cfg.options, { responsive: false, devicePixelRatio: 2, animation: false });
  const ch = new Chart(cv, cfg); const url = ch.toBase64Image('image/png'); ch.destroy(); box.remove(); return url;
}
async function exportPDF() {
  if (!window.jspdf) { toast('No se cargó la librería de PDF. Revisa la conexión.'); return; }
  $('#rep-msg').textContent = 'Generando PDF…';
  const root = document.documentElement, prevTheme = root.getAttribute('data-theme'); root.setAttribute('data-theme', 'light');
  try {
    ensureRendered(['tec', 'riesgo', 'chart', 'fut', 'opc', 'cob', 'opf', 'opo', 'comp', 'esc']);
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'pt', format: 'letter' }), W = doc.internal.pageSize.getWidth(), M = 40;
    const c = COL(), p = P(), B = bars(), ink = [19, 32, 51], acc = [29, 78, 158];
    let y = 0;
    const drawHead = () => { doc.setFillColor(...acc); doc.rect(0, 0, W, 6, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...acc); doc.text('MEXDER DERIVADOS LAB', M, 24); doc.setFont('helvetica', 'normal'); doc.setTextColor(110); doc.text(pdfSafe(`${S.name} (${S.symbol}) - corte ${S.all[S.all.length - 1]?.d}`), W - M, 24, { align: 'right' }); };
    const header = () => { drawHead(); y = 44; };
    const need = (h) => { if (y + h > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); header(); } };
    const h2 = (t, nx = 120) => { need(40 + nx); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...ink); doc.text(pdfSafe(t), M, y + 12); y += 24; };
    const img = (cfg, h = 210) => { need(h + 10); doc.addImage(chartImage(cfg, 1000, Math.round(1000 * h / (W - 2 * M))), 'PNG', M, y, W - 2 * M, h); y += h + 12; };
    const tbl = (sel, opts = {}) => { const a = (typeof sel === 'string' ? aoaTable(sel, true) : sel).map((r) => r.map((v) => pdfSafe(typeof v === 'number' ? fmt(v, 2) : v))); if (!a.length) return; need(50); doc.autoTable({ startY: y, head: [a[0]], body: a.slice(1), margin: { left: M, right: M, top: 44 }, styles: { fontSize: 7.5, cellPadding: 3, textColor: ink }, headStyles: { fillColor: [227, 236, 250], textColor: acc, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [247, 249, 251] }, didDrawPage: (d) => { if (d.pageNumber > 1 || doc.getCurrentPageInfo().pageNumber > 1) drawHead(); }, ...opts }); y = doc.lastAutoTable.finalY + 14; };
    const para = (t) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80); const lines = doc.splitTextToSize(pdfSafe(t), W - 2 * M); need(lines.length * 12); doc.text(lines, M, y + 8); y += lines.length * 12 + 6; };
    header();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...ink); doc.text('Informe de análisis y cobertura', M, y + 16); y += 30;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90); doc.text(pdfSafe(`Derivados MEXDER sobre ${S.name} - generado ${new Date().toLocaleString('es-MX')}`), M, y); y += 18;
    if (!S.live) para('Advertencia: este informe usa datos de demostración o cargados por el usuario. Verifique la fuente antes de tomar decisiones.');
    if (on('res')) { tbl([['Concepto', 'Valor'], ...execSummary()]); }
    if (on('hist') || on('tec')) { h2('Precio y retrocesos de Fibonacci', 220); const fb = T.fibo(B.map((b) => b.h), B.map((b) => b.l), S.tp?.fib || 120); img(cfgFib(B.slice(-160), fb, c)); }
    if (on('tec')) { h2('Osciladores', 160); const tr = technicalRead(B); img(cfgRSI(B.slice(-160), { r9: tr.r9.slice(-160), r14: tr.r14.slice(-160), r25: tr.r25.slice(-160) }, c), 150); tbl([['Señal', 'Valor', 'Lectura'], ...tr.sig.map((s) => [s.name, s.val != null ? fmt(s.val, 1) : '', s.txt])]); tbl('#t-fibt'); }
    if (on('fin')) { const A = finAnnual(); if (A.length) { h2('Estados financieros' + (fin().demo ? ' (ilustrativos)' : '')); for (const d of [DEF_ER, DEF_BAL, DEF_FLU, DEF_RAT]) { const t = stmtTable(A, d, yr); tbl([t.head, ...t.body]); } } }
    if (on('riesgo')) { h2('Patrones y riesgos'); tbl([['Métrica', 'Valor', 'Detalle'], ...$$('#r-stats .stat').map((s) => [s.querySelector('.l').textContent, s.querySelector('.v').textContent, s.querySelector('.s')?.textContent || ''])]); tbl('#t-beta'); }
    if (on('chart')) { h2('Análisis gráfico'); tbl('#t-sr'); const fg = detectFigures(B.slice(-(+$('#ch-n').value || 180)), +$('#ch-k').value || 5).figs; tbl([['Figura', 'Sesgo', 'Estado', 'Postura', 'Objetivo', 'Stop'], ...fg.map((f) => [f.name, f.bias, f.state, f.post, isNum(f.target) ? fmt(f.target) : '', isNum(f.stop) ? fmt(f.stop) : ''])]); }
    if (on('fut')) { h2('Contrato de futuros'); tbl([['Concepto', 'Valor', 'Detalle'], ...$$('#f-stats .stat').map((s) => [s.querySelector('.l').textContent, s.querySelector('.v').textContent, s.querySelector('.s')?.textContent || ''])]); tbl('#t-fpl'); }
    if (on('opc')) { h2('Opciones: Black-Scholes y binomial'); tbl('#t-cal'); tbl([['Concepto', 'Valor', 'Detalle'], ...$$('#o-stats .stat').map((s) => [s.querySelector('.l').textContent, s.querySelector('.v').textContent, s.querySelector('.s')?.textContent || ''])]); tbl('#t-greeks'); tbl([['Binomial', 'Valor', 'Detalle'], ...$$('#b-stats .stat').map((s) => [s.querySelector('.l').textContent, s.querySelector('.v').textContent, s.querySelector('.s')?.textContent || ''])]); }
    if (on('cob')) { h2('Coberturas y comparativas'); para($('#c-rec').innerText); tbl('#t-comp', { styles: { fontSize: 6.5, cellPadding: 2, textColor: ink } }); const st = S.lastComp?.sorted.slice(0, 4) || []; if (st.length) img(cfgPayoff(st.map((e) => ({ label: e.name, legs: e.legs })), p, c), 200); }
    if (on('esc')) { h2('Escenarios prospectivos por perfil'); tbl('#t-escdef'); for (const pr of ['cons', 'mod', 'agr']) { need(60); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...ink); doc.text(`Perfil ${PROF[pr]}`, M, y + 8); y += 14; tbl(`#t-esc-${pr}`, { styles: { fontSize: 6.8, cellPadding: 2, textColor: ink } }); } }
    if (on('ops')) { h2('Bitácora de operaciones'); tbl([['Fecha', 'Emisora', 'Postura', 'Contratos', 'Precio', 'Días', 'Stop'], ...S.trades.fut.map((t) => [t.date, t.sym, t.side > 0 ? 'Compra' : 'Venta', t.n, fmt(t.px), t.days, t.sl ? fmt(t.sl) : '—'])]); tbl([['Fecha', 'Emisora', 'Opción', 'Strike', 'Prima', 'Contratos', 'Días'], ...S.trades.opt.map((t) => [t.date, t.sym, `${t.side > 0 ? 'Larga' : 'Corta'} ${t.type === 'C' ? 'call' : 'put'}`, fmt(t.K), fmt(t.prem, 4), t.n, t.days])]); }
    para('Este informe es una herramienta de análisis y no constituye una recomendación de inversión. Los modelos (Black-Scholes, binomial, simulación lognormal) dependen de supuestos de volatilidad y tasa; las AIM reales las determina Asigna.');
    const pages = doc.getNumberOfPages(); for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140); doc.text(`Página ${i} de ${pages}`, W - M, doc.internal.pageSize.getHeight() - 20, { align: 'right' }); }
    const r = await saveFile(fileBase() + '.pdf', doc.output('blob'));
    $('#rep-msg').textContent = r === 'declined' ? 'Descarga cancelada.' : `Informe PDF generado (${pages} páginas).`;
  } finally {
    if (prevTheme) root.setAttribute('data-theme', prevTheme); else root.removeAttribute('data-theme');
    render();
  }
}

// ---------- Navegación, eventos e inicio ----------
const DERIV = new Set(['fut', 'opc', 'cob', 'opf', 'opo', 'comp', 'esc']);
const RENDER = { hist: renderHist, tec: renderTec, fin: renderFin, riesgo: renderRiesgo, chart: renderChart, fut: renderFut, opc: renderOpc, cob: renderCob, opf: renderOpf, opo: renderOpo, comp: renderComp, esc: renderEsc, rep: renderRep };
function showView(v, silent) {
  if (!silent) { S.view = v; store.set('view', v); }
  $$('main > section.view[id^="v-"]').forEach((s) => (s.hidden = s.id !== 'v-' + v));
  $('#params').hidden = !DERIV.has(v);
  $$('#nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.view === v ? 'page' : 'false'));
  if (S.all.length) { try { RENDER[v](); } catch (e) { console.error(e); } }
}
function render() { if (S.all.length) renderQuote(); showView(S.view); }
let rt = null; const later = () => { clearTimeout(rt); rt = setTimeout(render, 180); };

async function loadAll() {
  const sym = S.symbol; $('#quote').innerHTML = '<span class="muted small">Cargando…</span>';
  S.src = 'api';
  try {
    const [h, b] = await Promise.all([fetchJSON(`/api/history?symbol=${encodeURIComponent(sym)}&interval=1d&years=${S.years}`), fetchJSON(`/api/history?symbol=${encodeURIComponent(BENCH)}&interval=1d&years=${S.years}`)]);
    if (!h.rows || h.rows.length < 30) throw new Error('histórico insuficiente');
    S.all = h.rows; S.bench = b.rows || []; S.divs = h.dividends || []; S.name = h.name || sym; S.currency = h.currency || 'MXN'; S.live = true;
  } catch (e) {
    const d = demoSeries(sym, S.years); S.all = d.rows; S.bench = d.bench; S.divs = d.divs; S.name = d.name; S.live = false; S.src = 'demo';
  }
  try { if (!S.live) throw new Error('demo'); const f = await fetchJSON(`/api/fundamentals?symbol=${encodeURIComponent(sym)}`, 15000); S.fund = { ...f, demo: false }; if (!f.annual?.length && !f.summary) throw new Error('vacío'); }
  catch { S.fund = demoFundamentals(sym, lastClose()); }
  S.smile = null; PATHS = null; $('#s-k1').value = $('#s-k2').value = $('#s-k3').value = '';
  calibrate(); render();
}
function initUI() {
  setupChartDefaults();
  const sel = $('#sel-symbol'); sel.innerHTML = EMISORAS.map(([s, n]) => `<option value="${s}">${n} · ${s.replace('.MX', '')}</option>`).join('');
  if (!EMISORAS.some((e) => e[0] === S.symbol)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(S.symbol)}">${esc(S.symbol)}</option>`);
  sel.value = S.symbol;
  sel.addEventListener('change', () => { S.symbol = sel.value; store.set('symbol', S.symbol); loadAll(); });
  $('#btn-load').addEventListener('click', () => { let v = $('#in-symbol').value.trim().toUpperCase(); if (v) { if (!v.includes('.') && !v.startsWith('^')) v += '.MX'; S.symbol = v; if (![...sel.options].some((o) => o.value === v)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`); sel.value = v; store.set('symbol', v); } loadAll(); });
  $('#in-symbol').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-load').click(); });
  $$('#seg-cycle button').forEach((b) => { b.setAttribute('aria-pressed', b.dataset.v === S.cycle); b.addEventListener('click', () => { S.cycle = b.dataset.v; store.set('cycle', S.cycle); $$('#seg-cycle button').forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#in-ndays').hidden = S.cycle !== 'N'; PATHS = null; render(); }); });
  $('#in-ndays').hidden = S.cycle !== 'N'; $('#in-ndays').value = S.nDays;
  $('#in-ndays').addEventListener('change', () => { S.nDays = Math.max(2, +$('#in-ndays').value || 10); store.set('ndays', S.nDays); render(); });
  $$('#nav button').forEach((b) => b.addEventListener('click', () => { showView(b.dataset.view); window.scrollTo({ top: 0 }); }));
  $$('#h-ctype button').forEach((b) => b.addEventListener('click', () => { $$('#h-ctype button').forEach((x) => x.setAttribute('aria-pressed', x === b)); renderHist(); }));
  $('#h-years').addEventListener('change', () => { S.years = +$('#h-years').value; loadAll(); });
  for (const id of ['h-from', 'h-to']) $('#' + id).addEventListener('change', () => { S.from = $('#h-from').value; S.to = $('#h-to').value; render(); });
  $('#h-reset').addEventListener('click', () => { S.from = S.to = ''; $('#h-from').value = $('#h-to').value = ''; render(); });
  $('#h-csv').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; try { const rows = parseCSV(await f.text()); S.all = rows; S.src = 'csv'; S.live = false; S.name = f.name.replace(/\.csv$/i, ''); const d = demoSeries(S.symbol, Math.max(1, rows.length / 252 + 0.2)); const m = new Map(d.bench.map((x) => [x.d, x])); S.bench = rows.map((r) => m.get(r.d) || { ...r }); S.divs = []; S.fund = demoFundamentals(S.symbol, lastClose()); calibrate(); render(); toast(`CSV cargado: ${rows.length} filas`); } catch (err) { toast('No se pudo leer el CSV: ' + err.message); } e.target.value = ''; });
  $('#h-dl').addEventListener('click', () => { const csv = 'Date,Open,High,Low,Close,Adj Close,Volume\n' + bars().map((b) => [b.d, b.o, b.h, b.l, b.c, b.ac, b.v].join(',')).join('\n'); saveFile(`${S.symbol}_${S.cycle}.csv`, new Blob([csv], { type: 'text/csv' })); });
  $$('#fin-tabs button').forEach((b) => b.addEventListener('click', () => { $$('#fin-tabs button').forEach((x) => x.setAttribute('aria-selected', x === b)); renderFin(); }));
  // Parámetros
  const ms = mexderSeries(); $('#p-term-mx').innerHTML = ms.map((s) => `<option value="${s.code}">${s.code} · ${s.date} (${s.days} d)</option>`).join('');
  $('#p-term').addEventListener('change', () => { $('#f-term-mx').hidden = $('#p-term').value !== 'mx'; $('#f-term-c').hidden = $('#p-term').value !== 'custom'; PATHS = null; later(); });
  $('#p-volm').addEventListener('change', () => { recalcVol(); PATHS = null; later(); });
  $('#p-vol').addEventListener('input', () => { if ($('#p-volm').value !== 'iv') { $('#p-volm').value = 'iv'; $('#p-vol-h').textContent = 'manual'; } });
  $$('#params input, #params select, #v-tec input, #v-riesgo input, #v-riesgo select, #v-chart input, #v-fut input, #v-fut select, #v-opc .form input, #v-opc .form select, #v-cob .form input, #c-drift, #e-hz').forEach((el) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { if (el.id === 'r-win') $('#r-dates').hidden = el.value !== 'custom'; if (el.id === 's-w') { resetStrikes(); } later(); }));
  $('#s-reset').addEventListener('click', () => { resetStrikes(); renderCob(); });
  $('#s-book').addEventListener('click', bookStrategy);
  $('#o-auto').addEventListener('click', autoCalibrate);
  $('#of-fill').addEventListener('click', () => { const x = futCtx(); $('#of-side').value = x.side; $('#of-n').value = x.p.n; $('#of-px').value = x.Fp.toFixed(2); $('#of-days').value = x.p.days; const sl = (parseFloat($('#s-sl').value) || 5) / 100; $('#of-sl').value = (x.Fp * (1 - x.side * sl)).toFixed(2); });
  $('#of-add').addEventListener('click', () => { const t = { id: Date.now(), sym: S.symbol, side: +$('#of-side').value, n: Math.max(1, +$('#of-n').value || 1), px: parseFloat($('#of-px').value), days: Math.max(1, +$('#of-days').value || 30), date: today(), sl: parseFloat($('#of-sl').value) || null, tp: parseFloat($('#of-tp').value) || null, tag: 'Manual' }; if (!isNum(t.px)) { toast('Captura el precio pactado'); return; } S.trades.fut.push(t); saveTrades(); renderOpf(); toast('Operación de futuros registrada'); });
  $('#oo-add').addEventListener('click', () => { const p = P(), K = parseFloat($('#oo-K').value), type = $('#oo-type').value, days = Math.max(1, +$('#oo-days').value || 30); if (!isNum(K)) { toast('Captura el strike'); return; } const prem = parseFloat($('#oo-prem').value) || Q.bs(p.spot, K, days / 365, p.r, p.q, p.v, type).price; S.trades.opt.push({ id: Date.now(), sym: S.symbol, type, side: +$('#oo-side').value, K, prem: +prem.toFixed(4), n: Math.max(1, +$('#oo-n').value || 1), days, date: today(), tag: 'Manual' }); saveTrades(); renderOpo(); toast('Operación de opciones registrada'); });
  $('#rep-xls').addEventListener('click', () => exportXLS().catch((e) => { console.error(e); $('#rep-msg').textContent = 'No se pudo generar el Excel: ' + e.message; }));
  $('#rep-pdf').addEventListener('click', () => exportPDF().catch((e) => { console.error(e); $('#rep-msg').textContent = 'No se pudo generar el PDF: ' + e.message; }));
  $('#rep-print').addEventListener('click', () => window.print());
  const setTb = () => document.documentElement.style.setProperty('--tb', $('#topbar').offsetHeight + 'px'); setTb(); window.addEventListener('resize', setTb);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());
  new MutationObserver(() => later()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  showView(S.view);
  loadAll();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI); else initUI();
