/* ===================== MODELOS CUANTITATIVOS ===================== */
const Q = (() => {
  // ---------- Aleatorios reproducibles ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function hashStr(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------- Normal ----------
  function erfc(x) {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  const N = (x) => 0.5 * erfc(-x / Math.SQRT2);
  const npdf = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  function ninv(p) { // Acklam
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  // ---------- Estadística ----------
  const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  function std(a) { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(a.length - 1, 1)); }
  function cov(a, b) { const ma = mean(a), mb = mean(b); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb); return s / Math.max(a.length - 1, 1); }
  function logret(c) { const r = []; for (let i = 1; i < c.length; i++) r.push(Math.log(c[i] / c[i - 1])); return r; }
  function quantile(a, p) { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
  function linreg(y) { const n = y.length, xs = y.map((_, i) => i); const mx = mean(xs), my = mean(y); let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (y[i] - my); sxx += (xs[i] - mx) ** 2; } const b = sxy / (sxx || 1); return { slope: b, intercept: my - b * mx }; }

  // ---------- Volatilidad ----------
  function volHist(c, ppy) { const r = logret(c); return std(r) * Math.sqrt(ppy); }
  function volEWMA(c, ppy, lambda = 0.94) {
    const r = logret(c); if (r.length < 2) return NaN;
    let v = r.slice(0, Math.min(20, r.length)).reduce((s, x) => s + x * x, 0) / Math.min(20, r.length);
    for (const x of r) v = lambda * v + (1 - lambda) * x * x;
    return Math.sqrt(v * ppy);
  }
  function volParkinson(h, l, ppy) {
    let s = 0, n = 0;
    for (let i = 0; i < h.length; i++) if (h[i] > 0 && l[i] > 0 && h[i] >= l[i]) { s += Math.log(h[i] / l[i]) ** 2; n++; }
    return Math.sqrt(s / (4 * Math.log(2) * (n || 1)) * ppy);
  }

  // ---------- Black-Scholes-Merton ----------
  function bs(S, K, T, r, q, v, type) {
    if (T <= 0 || v <= 0) {
      const intr = type === 'C' ? Math.max(S - K, 0) : Math.max(K - S, 0);
      return { price: intr, delta: type === 'C' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, vega: 0, theta: 0, rho: 0, d1: NaN, d2: NaN, pITM: (type === 'C' ? S > K : S < K) ? 1 : 0 };
    }
    const sq = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r - q + 0.5 * v * v) * T) / (v * sq), d2 = d1 - v * sq;
    const dq = Math.exp(-q * T), dr = Math.exp(-r * T);
    let price, delta, theta, rho, pITM;
    if (type === 'C') {
      price = S * dq * N(d1) - K * dr * N(d2);
      delta = dq * N(d1);
      theta = -S * dq * npdf(d1) * v / (2 * sq) - r * K * dr * N(d2) + q * S * dq * N(d1);
      rho = K * T * dr * N(d2);
      pITM = N(d2);
    } else {
      price = K * dr * N(-d2) - S * dq * N(-d1);
      delta = -dq * N(-d1);
      theta = -S * dq * npdf(d1) * v / (2 * sq) + r * K * dr * N(-d2) - q * S * dq * N(-d1);
      rho = -K * T * dr * N(-d2);
      pITM = N(-d2);
    }
    const gamma = dq * npdf(d1) / (S * v * sq);
    const vega = S * dq * npdf(d1) * sq;
    return { price, delta, gamma, vega: vega / 100, theta: theta / 365, rho: rho / 100, d1, d2, pITM };
  }

  function impliedVol(target, S, K, T, r, q, type) {
    const intr = Math.max(type === 'C' ? S * Math.exp(-q * T) - K * Math.exp(-r * T) : K * Math.exp(-r * T) - S * Math.exp(-q * T), 0);
    if (!(target > intr) || T <= 0) return NaN;
    let v = 0.3;
    for (let i = 0; i < 50; i++) {
      const o = bs(S, K, T, r, q, v, type), diff = o.price - target, vg = o.vega * 100;
      if (Math.abs(diff) < 1e-8) return v;
      if (vg < 1e-8) break;
      const nv = v - diff / vg;
      if (!(nv > 0.0005 && nv < 5)) break;
      v = nv;
    }
    let lo = 1e-4, hi = 5;
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (bs(S, K, T, r, q, m, type).price > target) hi = m; else lo = m; if (hi - lo < 1e-8) break; }
    return (lo + hi) / 2;
  }

  // ---------- Binomial Cox-Ross-Rubinstein ----------
  function binomial(S, K, T, r, q, v, n, type, american, keepTree) {
    n = Math.max(1, Math.round(n));
    const dt = T / n, u = Math.exp(v * Math.sqrt(dt)), d = 1 / u;
    const a = Math.exp((r - q) * dt), p = (a - d) / (u - d), disc = Math.exp(-r * dt);
    const pay = (s) => type === 'C' ? Math.max(s - K, 0) : Math.max(K - s, 0);
    let V = new Array(n + 1);
    for (let j = 0; j <= n; j++) V[j] = pay(S * u ** (n - j) * d ** j);
    const tree = keepTree ? [V.map((val, j) => ({ S: S * u ** (n - j) * d ** j, V: val, ex: false }))] : null;
    for (let i = n - 1; i >= 0; i--) {
      const NV = new Array(i + 1), lvl = keepTree ? [] : null;
      for (let j = 0; j <= i; j++) {
        const s = S * u ** (i - j) * d ** j;
        let cont = disc * (p * V[j] + (1 - p) * V[j + 1]), ex = false;
        if (american) { const e = pay(s); if (e > cont + 1e-12) { cont = e; ex = true; } }
        NV[j] = cont;
        if (keepTree) lvl.push({ S: s, V: cont, ex });
      }
      V = NV;
      if (keepTree) tree.unshift(lvl);
    }
    return { price: V[0], u, d, p, dt, a, tree };
  }

  // ---------- Simulación lognormal ----------
  function simulate(S0, T, mu, v, nPaths, steps, seed) {
    const r = rng(seed), dt = T / steps, drift = (mu - 0.5 * v * v) * dt, vol = v * Math.sqrt(dt);
    const paths = [];
    for (let k = 0; k < nPaths; k++) {
      const p = new Float64Array(steps + 1); p[0] = S0;
      for (let i = 1; i <= steps; i++) p[i] = p[i - 1] * Math.exp(drift + vol * gauss(r));
      paths.push(p);
    }
    return paths;
  }

  // ---------- Motor de estrategias ----------
  // pata: {k:'C'|'P'|'F'|'FSL', q:+n|-n (en contratos), K, prem (por acción), stop}
  function legPayoff(L, ST, pathMin, pathMax) {
    switch (L.k) {
      case 'C': return L.q * (Math.max(ST - L.K, 0) - L.prem);
      case 'P': return L.q * (Math.max(L.K - ST, 0) - L.prem);
      case 'F': return L.q * (ST - L.K);
      case 'FSL': {
        // futuro con stop: larga si q>0 (stop abajo), corta si q<0 (stop arriba)
        if (L.q > 0) { const hit = pathMin != null ? pathMin <= L.stop : ST <= L.stop; return L.q * ((hit ? L.stop : ST) - L.K); }
        const hit = pathMax != null ? pathMax >= L.stop : ST >= L.stop; return L.q * ((hit ? L.stop : ST) - L.K);
      }
    }
    return 0;
  }
  function payoff(legs, ST, mult, pathMin, pathMax) { let s = 0; for (const L of legs) s += legPayoff(L, ST, pathMin, pathMax); return s * mult; }
  function valueAt(legs, St, tau, r, q, v, mult, Fcarry) {
    // valor de mercado a t (tau = tiempo remanente) menos costo
    let s = 0;
    for (const L of legs) {
      if (L.k === 'C' || L.k === 'P') s += L.q * (bs(St, L.K, tau, r, q, v, L.k).price - L.prem);
      else if (L.k === 'F') s += L.q * (St * Math.exp((r - q) * tau) - L.K);
      else if (L.k === 'FSL') {
        const Ft = St * Math.exp((r - q) * tau);
        if (L.q > 0) s += L.q * ((St <= L.stop ? L.stop : Ft) - L.K); else s += L.q * ((St >= L.stop ? L.stop : Ft) - L.K);
      }
    }
    return s * mult;
  }
  function netPremium(legs, mult) { let s = 0; for (const L of legs) if (L.k === 'C' || L.k === 'P') s += L.q * L.prem; return s * mult; }

  function strategyMetrics(legs, S, mult) {
    const lo = S * 0.01, hi = S * 3, xs0 = [];
    for (let i = 0; i <= 1200; i++) xs0.push(lo + (hi - lo) * i / 1200);
    for (const L of legs) { if (L.K) xs0.push(L.K); if (L.stop) xs0.push(L.stop, L.stop * 0.9999, L.stop * 1.0001); }
    const xs = [...new Set(xs0)].sort((a, b) => a - b), ys = xs.map((x) => payoff(legs, x, mult)), n = xs.length - 1;
    const maxG = Math.max(...ys), maxL = Math.min(...ys);
    const slopeR = ys[n] - ys[n - 1], slopeL = ys[1] - ys[0];
    const be = [];
    for (let i = 1; i <= n; i++) if ((ys[i - 1] < 0 && ys[i] >= 0) || (ys[i - 1] > 0 && ys[i] <= 0)) {
      const x = xs[i - 1] + (xs[i] - xs[i - 1]) * (0 - ys[i - 1]) / (ys[i] - ys[i - 1]); be.push(x);
    }
    return {
      maxGain: slopeR > 1e-9 ? Infinity : maxG,
      maxLoss: slopeR < -1e-9 ? -Infinity : (slopeL > 1e-9 && ys[0] < maxL + 1e-9 ? maxL : maxL),
      breakevens: be,
    };
  }

  function mcStats(legs, paths, mult) {
    const pl = [];
    for (const p of paths) {
      let mn = Infinity, mx = -Infinity; for (const x of p) { if (x < mn) mn = x; if (x > mx) mx = x; }
      pl.push(payoff(legs, p[p.length - 1], mult, mn, mx));
    }
    const win = pl.filter((x) => x > 0).length / pl.length;
    const ev = mean(pl), sd = std(pl);
    const var95 = -quantile(pl, 0.05), cvar = -mean(pl.filter((x) => x <= -var95));
    return { pWin: win, ev, sd, var95, cvar: isFinite(cvar) ? cvar : var95, pl };
  }

  return { rng, gauss, hashStr, N, npdf, ninv, mean, std, cov, logret, quantile, linreg, volHist, volEWMA, volParkinson, bs, impliedVol, binomial, simulate, payoff, valueAt, netPremium, strategyMetrics, mcStats };
})();
if (typeof module !== 'undefined') module.exports = Q;
