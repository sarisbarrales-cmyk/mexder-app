// GET /api/fundamentals?symbol=WALMEX.MX
// Resumen, estados financieros anuales y trimestrales, dividendos y previsiones.
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function safe(p) {
  try { return await p; } catch (e) { return { __error: String(e && e.message || e) }; }
}

function cleanSeries(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((row) => {
    const out = { date: new Date(row.date).toISOString().slice(0, 10) };
    for (const [k, v] of Object.entries(row)) {
      if (k === "date" || k === "TYPE" || k === "periodType") continue;
      if (typeof v === "number") out[k] = v;
    }
    return out;
  });
}

export default async function handler(req, res) {
  const symbol = String(req.query.symbol || "WALMEX.MX").toUpperCase();
  const fiveYearsAgo = new Date(Date.now() - 6 * 365.25 * 864e5);
  const twoYearsAgo = new Date(Date.now() - 2.5 * 365.25 * 864e5);

  const [summary, annual, quarterly] = await Promise.all([
    safe(yf.quoteSummary(symbol, {
      modules: [
        "price", "summaryDetail", "financialData", "defaultKeyStatistics",
        "calendarEvents", "earningsTrend", "recommendationTrend", "assetProfile", "earnings",
      ],
    }, { validateResult: false })),
    safe(yf.fundamentalsTimeSeries(symbol, { period1: fiveYearsAgo, type: "annual", module: "all" }, { validateResult: false })),
    safe(yf.fundamentalsTimeSeries(symbol, { period1: twoYearsAgo, type: "quarterly", module: "all" }, { validateResult: false })),
  ]);

  if (summary.__error && annual.__error) {
    return res.status(502).json({ error: "No se pudieron obtener los fundamentales", detail: summary.__error });
  }

  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.status(200).json({
    symbol,
    summary: summary.__error ? null : summary,
    annual: annual.__error ? [] : cleanSeries(annual),
    quarterly: quarterly.__error ? [] : cleanSeries(quarterly),
    source: "Yahoo Finance",
    fetchedAt: new Date().toISOString(),
  });
}
