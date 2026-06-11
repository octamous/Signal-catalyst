/**
 * Server-side Finnhub live-market-data client.
 *
 * The Finnhub API key lives ONLY on the server (FINNHUB_API_KEY) and is never
 * sent to the browser. Everything here degrades gracefully:
 *   - No key            → dataStatus "no_key", all fields null/empty, no throw.
 *   - Key present, all
 *     sub-calls fail     → dataStatus "unavailable", errors populated.
 *   - Key present, some
 *     calls succeed      → dataStatus "live" with whatever was fetched.
 *
 * We use the platform `fetch` (Node 18+/20). Each call has a short timeout and
 * is wrapped so a single failure (rate limit, network, bad symbol) never throws
 * out of the service — the caller always gets a normalized LiveMarketData.
 *
 * Endpoints used (all GET, token in querystring):
 *   /search?q=             symbol lookup
 *   /quote?symbol=         latest quote
 *   /stock/profile2?symbol= company profile
 *   /stock/metric?symbol=&metric=all   basic financials
 *   /company-news?symbol=&from=&to=    company headlines
 *   /news?category=general general market news
 *
 * Finnhub does not expose dedicated free crypto/forex "news" categories beyond
 * `category=crypto` and `category=forex` on the same /news endpoint, which we
 * support; anything else falls back to general. (Documented limitation.)
 */
import type {
  LiveDataStatus,
  LiveMarketData,
  LiveMarketNewsItem,
  LiveMetrics,
  LiveNewsItem,
  LiveProfile,
  LiveQuote,
} from "@shared/schema";

const BASE_URL = "https://finnhub.io/api/v1";
const CALL_TIMEOUT_MS = 8_000;

export function finnhubKey(): string | undefined {
  const k = process.env.FINNHUB_API_KEY?.trim();
  return k || undefined;
}

export function hasFinnhub(): boolean {
  return Boolean(finnhubKey());
}

/** A single guarded GET. Returns null on any failure and records the reason. */
async function getJson<T>(
  path: string,
  params: Record<string, string>,
  errors: string[],
): Promise<T | null> {
  const key = finnhubKey();
  if (!key) return null;
  const qs = new URLSearchParams({ ...params, token: key }).toString();
  const url = `${BASE_URL}${path}?${qs}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      errors.push(`${path} HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    errors.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type FinnhubSearchResult = {
  count: number;
  result: { symbol: string; displaySymbol: string; description: string; type: string }[];
};

/**
 * Resolve a free-text query (name, "SOFI tech", or a symbol) to the best
 * Finnhub symbol. Prefers an exact symbol match, then US common stock, then the
 * first result. Returns null if the key is missing or nothing matches.
 */
export async function resolveSymbol(query: string): Promise<string | null> {
  const errors: string[] = [];
  const data = await getJson<FinnhubSearchResult>("/search", { q: query }, errors);
  const results = data?.result ?? [];
  if (!results.length) return null;

  const upper = query.trim().toUpperCase();
  const exact = results.find((r) => r.symbol.toUpperCase() === upper);
  if (exact) return exact.symbol;

  // Prefer a plain US common stock symbol (no dot/colon exchange suffix).
  const usCommon = results.find(
    (r) => r.type === "Common Stock" && /^[A-Z][A-Z.]{0,5}$/.test(r.symbol),
  );
  if (usCommon) return usCommon.symbol;

  return results[0].symbol;
}

function mapQuote(raw: any): LiveQuote | null {
  if (!raw || typeof raw !== "object") return null;
  const current = num(raw.c);
  // Finnhub returns c:0 for unknown symbols — treat all-zero as no quote.
  if (current === null || (current === 0 && num(raw.pc) === 0)) return null;
  return {
    current,
    change: num(raw.d) ?? 0,
    percentChange: num(raw.dp) ?? 0,
    high: num(raw.h) ?? 0,
    low: num(raw.l) ?? 0,
    open: num(raw.o) ?? 0,
    previousClose: num(raw.pc) ?? 0,
  };
}

function mapProfile(raw: any): LiveProfile | null {
  if (!raw || typeof raw !== "object" || !raw.name) return null;
  return {
    name: String(raw.name),
    ticker: String(raw.ticker ?? ""),
    exchange: String(raw.exchange ?? ""),
    country: String(raw.country ?? ""),
    currency: String(raw.currency ?? ""),
    industry: String(raw.finnhubIndustry ?? ""),
    marketCapitalization: num(raw.marketCapitalization) ?? 0,
    shareOutstanding: num(raw.shareOutstanding) ?? 0,
    ipo: String(raw.ipo ?? ""),
    weburl: String(raw.weburl ?? ""),
    logo: String(raw.logo ?? ""),
  };
}

function mapMetrics(raw: any): LiveMetrics | null {
  const m = raw?.metric;
  if (!m || typeof m !== "object") return null;
  return {
    peTtm: num(m.peTTM ?? m.peBasicExclExtraTTM),
    psTtm: num(m.psTTM),
    evToEbitdaTtm: num(m["currentEv/ebitdaTTM"]) ?? num(m.evToEbitdaTTM) ?? num(m.evToEbitdaAnnual),
    grossMarginTtm: num(m.grossMarginTTM),
    netMarginTtm: num(m.netProfitMarginTTM),
    revenueGrowthTtmYoy: num(m.revenueGrowthTTMYoy),
    high52Week: num(m["52WeekHigh"]),
    low52Week: num(m["52WeekLow"]),
    beta: num(m.beta),
  };
}

function mapNews(raw: any): LiveNewsItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n) => n && (n.headline || n.summary))
    .slice(0, 12)
    .map((n: any) => ({
      id: num(n.id) ?? 0,
      datetime: num(n.datetime) ?? 0,
      headline: String(n.headline ?? ""),
      summary: String(n.summary ?? ""),
      source: String(n.source ?? ""),
      url: String(n.url ?? ""),
      category: String(n.category ?? ""),
      related: String(n.related ?? ""),
    }));
}

function statusFor(
  hasKey: boolean,
  anySuccess: boolean,
): LiveDataStatus {
  if (!hasKey) return "no_key";
  return anySuccess ? "live" : "unavailable";
}

/**
 * Fetch the full normalized live snapshot for a resolved symbol. Runs the
 * quote/profile/metrics/company-news calls in parallel; each is independently
 * guarded so a partial outage still returns usable data.
 */
export async function getLiveMarketData(symbol: string): Promise<LiveMarketData> {
  const errors: string[] = [];
  const fetchedAt = Date.now();
  const hasKey = hasFinnhub();

  if (!hasKey) {
    return {
      dataStatus: "no_key",
      provider: "finnhub",
      resolvedSymbol: symbol || null,
      quote: null,
      profile: null,
      metrics: null,
      companyNews: [],
      marketNews: [],
      fetchedAt,
      errors: [],
    };
  }

  const to = new Date();
  const from = new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [quoteRaw, profileRaw, metricRaw, newsRaw] = await Promise.all([
    getJson<any>("/quote", { symbol }, errors),
    getJson<any>("/stock/profile2", { symbol }, errors),
    getJson<any>("/stock/metric", { symbol, metric: "all" }, errors),
    getJson<any>("/company-news", { symbol, from: ymd(from), to: ymd(to) }, errors),
  ]);

  const quote = mapQuote(quoteRaw);
  const profile = mapProfile(profileRaw);
  const metrics = mapMetrics(metricRaw);
  const companyNews = mapNews(newsRaw);

  const anySuccess = Boolean(quote || profile || metrics || companyNews.length);

  return {
    dataStatus: statusFor(hasKey, anySuccess),
    provider: "finnhub",
    resolvedSymbol: symbol || null,
    quote,
    profile,
    metrics,
    companyNews,
    marketNews: [],
    fetchedAt,
    errors,
  };
}

const NEWS_CATEGORIES = new Set(["general", "forex", "crypto", "merger"]);

/** General/category market news for the Market Impact page. */
export async function getMarketNews(category = "general"): Promise<LiveNewsItem[]> {
  const errors: string[] = [];
  const cat = NEWS_CATEGORIES.has(category) ? category : "general";
  const raw = await getJson<any>("/news", { category: cat }, errors);
  return mapNews(raw);
}

// Lightweight keyword heuristics so the Market Impact page can label live
// headlines without a model call. Intentionally simple and transparent.
const BULLISH = /(beat|surge|soar|rally|record|upgrade|raise|jump|gain|approval|tops|strong|growth|profit)/i;
const BEARISH = /(miss|plunge|fall|drop|cut|downgrade|lawsuit|probe|recall|warn|weak|loss|decline|slump|fraud|halt)/i;
const VOLATILE = /(fed|fomc|cpi|inflation|rate decision|jobs report|earnings|guidance|election|tariff)/i;

function classifyBias(text: string): LiveMarketNewsItem["bias"] {
  const bull = BULLISH.test(text);
  const bear = BEARISH.test(text);
  if (bull && bear) return "Mixed";
  if (bull) return "Bullish";
  if (bear) return "Bearish";
  if (VOLATILE.test(text)) return "Volatility";
  return "Mixed";
}

/** Best-effort extraction of $TICKER / TICKER tokens from a headline. */
function extractSymbols(item: LiveNewsItem): string[] {
  const fromRelated = item.related
    ? item.related.split(/[,\s]+/).filter((s) => /^[A-Z]{1,5}$/.test(s))
    : [];
  if (fromRelated.length) return Array.from(new Set(fromRelated)).slice(0, 4);
  const matches = item.headline.match(/\$?[A-Z]{2,5}\b/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.replace("$", "")))).slice(0, 3);
}

/** Map raw company/market news into the classified Market Impact news shape. */
export function classifyMarketNews(items: LiveNewsItem[]): LiveMarketNewsItem[] {
  return items.slice(0, 8).map((n) => ({
    id: n.id,
    datetime: n.datetime,
    headline: n.headline,
    summary: n.summary,
    source: n.source,
    url: n.url,
    bias: classifyBias(`${n.headline} ${n.summary}`),
    affected: extractSymbols(n),
  }));
}
