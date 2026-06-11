/**
 * Server-side Claude (Anthropic Messages API) report generation.
 *
 * Secrets stay on the server. The frontend never sees the API key — it only
 * ever calls POST /api/companies/:ticker/generate-analysis.
 *
 * Credential resolution priority (first complete pair wins):
 *   1. ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL (default https://api.anthropic.com)
 *      — standard production env vars.
 *   2. CUSTOM_CRED_API_ANTHROPIC_COM_TOKEN + CUSTOM_CRED_API_ANTHROPIC_COM_URL
 *      — the Perplexity secure credential proxy for api.anthropic.com.
 *   3. CUSTOM_CRED_PLATFORM_CLAUDE_COM_TOKEN + CUSTOM_CRED_PLATFORM_CLAUDE_COM_URL
 *      — legacy fallback from the earlier (wrong) host, only used if present.
 *
 * Model is overridable via ANTHROPIC_MODEL.
 *
 * If no credentials are present, or the live call fails for any reason, we
 * return a polished structured fallback flagged `generatedBy: 'mock'` with a
 * small internal `debug` summary. We never crash the request.
 */
import type {
  AnalysisMethod,
  BearFlag,
  Company,
  CompanyReport,
  GeneratedAnalysis,
  LiveMarketData,
  MarketViewSection,
  PeerRow,
  ResearchRating,
} from "@shared/schema";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

const PEER_COLUMNS = [
  "Ticker",
  "P/S TTM",
  "P/S Fwd",
  "P/FCF",
  "EV/EBITDA",
  "Gross %",
  "Rev Growth %",
  "Value/Growth",
];

type GenerateInput = {
  ticker: string;
  method: AnalysisMethod;
  company: Company;
  report: CompanyReport | undefined;
  peer: { rows: PeerRow[]; defaultCompetitors: string[] } | undefined;
  competitors: string[];
  /** Normalized Finnhub snapshot; null when no live layer ran. */
  live: LiveMarketData | null;
};

/** True when the live snapshot carries at least one usable live figure/headline. */
function hasLiveSignal(live: LiveMarketData | null): boolean {
  if (!live || live.dataStatus !== "live") return false;
  return Boolean(live.quote || live.metrics || live.profile || live.companyNews.length);
}

/** Render the live snapshot as a compact, prompt-friendly context block. */
function renderLiveContext(live: LiveMarketData | null): string {
  if (!live) return "No live-data layer ran for this request (Finnhub not configured).";
  if (live.dataStatus === "no_key") {
    return "Finnhub is NOT configured — there is NO live price, metric, or news data. Treat everything as offline.";
  }
  if (live.dataStatus === "unavailable") {
    return `Finnhub was configured but every live call failed (${live.errors.slice(0, 3).join("; ") || "unknown"}). Treat as NO live data.`;
  }

  const parts: string[] = [`LIVE DATA via Finnhub (fetched ${new Date(live.fetchedAt).toISOString()}):`];
  if (live.profile) {
    parts.push(
      `Profile: ${live.profile.name} (${live.profile.ticker || live.resolvedSymbol}), ${live.profile.industry || "industry n/a"}, ` +
        `exchange ${live.profile.exchange || "n/a"}, mkt cap ~${live.profile.marketCapitalization} (USD mm).`,
    );
  }
  if (live.quote) {
    parts.push(
      `Quote: last ${live.quote.current} (${live.quote.percentChange >= 0 ? "+" : ""}${live.quote.percentChange.toFixed(2)}% vs prev close ${live.quote.previousClose}; ` +
        `day range ${live.quote.low}-${live.quote.high}).`,
    );
  }
  if (live.metrics) {
    const m = live.metrics;
    const fmt = (n: number | null, suffix = "") => (n === null ? "n/a" : `${n}${suffix}`);
    parts.push(
      `Metrics (TTM): P/E ${fmt(m.peTtm)}, P/S ${fmt(m.psTtm)}, EV/EBITDA ${fmt(m.evToEbitdaTtm)}, ` +
        `gross margin ${fmt(m.grossMarginTtm, "%")}, net margin ${fmt(m.netMarginTtm, "%")}, ` +
        `rev growth YoY ${fmt(m.revenueGrowthTtmYoy, "%")}, beta ${fmt(m.beta)}, 52w ${fmt(m.low52Week)}-${fmt(m.high52Week)}.`,
    );
  }
  if (live.companyNews.length) {
    const heads = live.companyNews
      .slice(0, 6)
      .map((n) => `- [${new Date(n.datetime * 1000).toISOString().slice(0, 10)}] ${n.headline} (${n.source})`)
      .join("\n");
    parts.push(`Recent company news (last ~14d):\n${heads}`);
  } else {
    parts.push("No recent company news returned by the live feed.");
  }
  return parts.join("\n");
}

export type ResolvedCredential = { url: string; token: string; source: string } | null;

/** Resolve credentials in the documented priority order. Shared with the AI chat helper. */
export function resolveCredential(): ResolvedCredential {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const url = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").trim();
    return { url, token: apiKey, source: "ANTHROPIC_API_KEY" };
  }
  const proxyToken = process.env.CUSTOM_CRED_API_ANTHROPIC_COM_TOKEN;
  const proxyUrl = process.env.CUSTOM_CRED_API_ANTHROPIC_COM_URL;
  if (proxyToken && proxyUrl) {
    return { url: proxyUrl.trim(), token: proxyToken, source: "CUSTOM_CRED_API_ANTHROPIC_COM" };
  }
  const legacyToken = process.env.CUSTOM_CRED_PLATFORM_CLAUDE_COM_TOKEN;
  const legacyUrl = process.env.CUSTOM_CRED_PLATFORM_CLAUDE_COM_URL;
  if (legacyToken && legacyUrl) {
    return { url: legacyUrl.trim(), token: legacyToken, source: "CUSTOM_CRED_PLATFORM_CLAUDE_COM" };
  }
  return null;
}

/** Builds the Anthropic Messages-API system + user prompt for the 3-step stack. */
function buildPrompt(input: GenerateInput): { system: string; user: string } {
  const { ticker, method, competitors, company, peer, live } = input;
  const peerList = competitors.length ? competitors.join(", ") : "two closest public peers";
  const liveOn = hasLiveSignal(live);

  const steps = method.steps
    .map((s) => {
      let prompt = s.prompt.replaceAll("[TICKER]", ticker);
      prompt = prompt
        .replace("[COMPETITOR 1]", competitors[0] ?? "[COMPETITOR 1]")
        .replace("[COMPETITOR 2]", competitors[1] ?? "[COMPETITOR 2]")
        .replace("[PEER 1]", competitors[0] ?? "[PEER 1]")
        .replace("[PEER 2]", competitors[1] ?? "[PEER 2]");
      return `STEP ${s.step} — ${s.title} (${s.subtitle}):\n${prompt}`;
    })
    .join("\n\n");

  const peerContext = peer?.rows.length
    ? `\n\nReference peer valuation data (seeded, may be stale):\n${JSON.stringify(peer.rows)}`
    : "";

  const liveContext = renderLiveContext(live);

  const system =
    "You are a rigorous buy-side alpha analyst hunting mispriced, high-potential equities for a sophisticated " +
    "investor's own research workflow. Be specific, quantitative, skeptical, and PRACTICAL. No educational fluff, " +
    "no generic disclaimers padding the answer. This is a research tool, NOT personalized financial advice — " +
    "express conclusions only as a research verdict, never as a personal instruction to buy or sell.\n\n" +
    "OUTPUT IS FOUR SECTIONS, in this order:\n" +
    "A) Verdict — one of BUY_CANDIDATE / SELL_OR_AVOID / WATCHLIST / NO_EDGE, with confidence and a time horizon.\n" +
    "B) What the live data/news likely does to the stock — bullish / bearish / mixed, the likely market reaction, and WHY.\n" +
    "C) Bull case — the concrete upside.\n" +
    "D) Bear case + the EXACT triggers/events that would change the view.\n\n" +
    "VERDICT DISCIPLINE:\n" +
    (liveOn
      ? "- You DO have a live Finnhub snapshot (quote / metrics / recent news) below. USE the specific live numbers and " +
        "headlines explicitly in your reasoning and cite them. A strong call (BUY_CANDIDATE or SELL_OR_AVOID) is allowed " +
        "ONLY when the live data and news directly support it; otherwise WATCHLIST or NO_EDGE.\n"
      : "- You have NO live market/news/fundamental feed for this request. Any numbers in context are seeded/illustrative " +
        "and may be stale. Do NOT invent live prices or 'today's' figures.\n" +
        "- Without live evidence, default to WATCHLIST (plausible thesis worth tracking) or NO_EDGE (no discernible edge). " +
        "Never issue an arbitrary BUY_CANDIDATE or SELL_OR_AVOID to seem decisive.\n") +
    "- Never claim certainty. State what would change the verdict.\n" +
    "- `confidence` must be Low whenever the verdict rests on seed/illustrative data rather than live figures.\n" +
    "- Map your verdict to the JSON `rating` field using EXACTLY these tokens: BUY_CANDIDATE, AVOID (for sell/avoid), " +
    "WATCHLIST, or NO_EDGE.\n\n" +
    "Respond with a single minified JSON object only — no prose outside the JSON.";

  const user =
    `Run the "${method.name}" alpha analysis on ${ticker} (${company.name}, ${company.sector}) vs ${peerList}.\n\n` +
    `LIVE MARKET CONTEXT:\n${liveContext}\n\n` +
    (liveOn
      ? `Use the live figures and headlines above directly in sections A–D. In section B explain what this specific data/news likely does to the stock and why.\n\n`
      : `No live data is connected for this request. Default to WATCHLIST or NO_EDGE unless seeded evidence justifies more, and name the live data you would need.\n\n`) +
    `${steps}${peerContext}\n\n` +
    `Return STRICT JSON matching EXACTLY this TypeScript type and nothing else:\n` +
    `{\n` +
    `  "marketView": {\n` +
    `    "lean": "Bullish"|"Bearish"|"Mixed",  // overall read of the live data/news\n` +
    `    "summary": string,  // what the data/news likely does to the stock + likely market reaction and why\n` +
    `    "drivers": string[] // 2-4 specific data points / headlines driving the read (cite live figures when present)\n` +
    `  },\n` +
    `  "deepDive": {\n` +
    `    "summary": string,\n` +
    `    "businessModel": string[],   // 2-4 bullets\n` +
    `    "moatCompetition": string[], // 2-4 bullets\n` +
    `    "catalysts": string[],       // 2-4 bullets, next ~12 months\n` +
    `    "asymmetry": string[]        // 2-3 bullets: valuation floor vs growth ceiling\n` +
    `  },\n` +
    `  "peerValuation": {\n` +
    `    "summary": string,\n` +
    `    "rows": { "ticker": string, "isSubject": boolean, "psTtm": number, "psFwd": number, "pFcf": number|null, "evEbitda": number, "grossMargin": number, "revGrowth": number, "valueGrowthScore": number }[],\n` +
    `    "note": string\n` +
    `  },\n` +
    `  "bearCase": {\n` +
    `    "summary": string,\n` +
    `    "redFlags": { "rank": number, "severity": "Severe"|"High"|"Moderate", "title": string, "detail": string, "source": string, "whatWouldDisprove": string }[]  // 3 flags ranked by severity, each with an exact trigger that flips the view\n` +
    `  },\n` +
    `  "generalVerdict": {\n` +
    `    "rating": "BUY_CANDIDATE"|"WATCHLIST"|"AVOID"|"NO_EDGE",  // AVOID == sell/avoid; default WATCHLIST/NO_EDGE without live evidence\n` +
    `    "confidence": "Low"|"Medium"|"High",  // Low when based on seed/illustrative data\n` +
    `    "why": string,  // include time horizon; if no live data, name the explicit data gaps needed for a strong call\n` +
    `    "keyConditions": string[],   // 2-4 exact triggers / data points that would change the verdict\n` +
    `    "notFinancialAdvice": true\n` +
    `  }\n` +
    `}`;

  return { system, user };
}

const VALID_RATINGS: ResearchRating[] = ["BUY_CANDIDATE", "WATCHLIST", "AVOID", "NO_EDGE"];

function normalizeRating(value: unknown): ResearchRating {
  const v = String(value ?? "").toUpperCase().replace(/[\s-]/g, "_");
  return (VALID_RATINGS.includes(v as ResearchRating) ? v : "NO_EDGE") as ResearchRating;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const arr = value.map((v) => String(v)).filter(Boolean);
    if (arr.length) return arr;
  }
  return fallback;
}

/** Build the Section-B market view from whatever live signal exists. */
function buildMockMarketView(input: GenerateInput): MarketViewSection {
  const { ticker, live } = input;
  if (!hasLiveSignal(live) || !live) {
    return {
      lean: "Mixed",
      summary:
        `No live market/news feed is connected for ${ticker}, so there is no fresh data to read a near-term reaction from. ` +
        `Connect a live feed (price, metrics, recent headlines) to judge what news would likely do to the stock.`,
      drivers: ["Live quote and % change vs prior close", "TTM valuation and margin metrics", "Recent company headlines (last ~14 days)"],
    };
  }

  const drivers: string[] = [];
  let bull = 0;
  let bear = 0;

  if (live.quote) {
    const dir = live.quote.percentChange >= 0 ? "up" : "down";
    if (live.quote.percentChange >= 1) bull++;
    if (live.quote.percentChange <= -1) bear++;
    drivers.push(
      `Last ${live.quote.current} (${live.quote.percentChange >= 0 ? "+" : ""}${live.quote.percentChange.toFixed(2)}% on the session; trading ${dir} vs prior close ${live.quote.previousClose}).`,
    );
  }
  if (live.metrics) {
    const g = live.metrics.revenueGrowthTtmYoy;
    const ps = live.metrics.psTtm;
    if (g !== null && g >= 20) bull++;
    if (g !== null && g <= 0) bear++;
    if (ps !== null && ps >= 20) bear++;
    drivers.push(
      `Valuation/growth: P/S ${ps ?? "n/a"}, rev growth YoY ${g === null ? "n/a" : g + "%"}, gross margin ${live.metrics.grossMarginTtm ?? "n/a"}%.`,
    );
  }
  if (live.companyNews.length) {
    bull += live.companyNews.filter((n) => /beat|surge|raise|upgrade|record|strong/i.test(n.headline)).length;
    bear += live.companyNews.filter((n) => /miss|cut|downgrade|probe|lawsuit|warn|weak|fall/i.test(n.headline)).length;
    drivers.push(`Latest headline: "${live.companyNews[0].headline}" (${live.companyNews[0].source}).`);
  }

  const lean: MarketViewSection["lean"] = bull > bear ? "Bullish" : bear > bull ? "Bearish" : "Mixed";
  const summary =
    `${ticker} live read leans ${lean.toLowerCase()}: ` +
    (lean === "Bullish"
      ? "the recent price action, metrics, and headlines skew constructive — a continuation is the higher-probability near-term path, but confirm against the next catalyst."
      : lean === "Bearish"
        ? "the recent data and headlines skew negative — near-term pressure is the higher-probability path until the trend turns."
        : "the live signals are mixed, so the next catalyst (earnings, guidance, or a macro print) is likely to set direction rather than current momentum.");

  return { lean, summary, drivers: drivers.length ? drivers : ["Live data attached but thin — treat the read as low-conviction."] };
}

/** Deterministic, polished fallback derived from seeded + any live data. */
export function buildMockAnalysis(input: GenerateInput, debug?: string): GeneratedAnalysis {
  const { ticker, method, company, report, peer, competitors, live } = input;
  const liveOn = hasLiveSignal(live);
  const subjectRows = peer?.rows ?? [];
  // Peer data is only "usable" if it carries real (non-zero) figures. SOFI-style
  // placeholder rows are all zeros — treat them as no usable valuation data so we
  // never claim a name "screens cheapest" off blank numbers.
  const hasUsablePeerData = subjectRows.some(
    (r) => r.psTtm !== 0 || r.psFwd !== 0 || r.revGrowth !== 0 || r.valueGrowthScore !== 0,
  );
  const bestScore = hasUsablePeerData
    ? Math.min(...subjectRows.map((r) => r.valueGrowthScore))
    : null;
  const subject = subjectRows.find((r) => r.isSubject);
  const peerList = competitors.join(", ") || "closest peers";

  const liveSummary =
    liveOn && live
      ? `${live.profile?.name ?? company.name} (${live.resolvedSymbol ?? ticker})` +
        (live.quote ? ` last traded ${live.quote.current} (${live.quote.percentChange >= 0 ? "+" : ""}${live.quote.percentChange.toFixed(2)}%)` : "") +
        (live.metrics?.revenueGrowthTtmYoy != null ? `, rev growth ${live.metrics.revenueGrowthTtmYoy}% YoY` : "") +
        (live.profile?.industry ? `, in ${live.profile.industry}.` : ".")
      : null;

  const deepDive = {
    summary:
      liveSummary ??
      report?.deepDive?.[0]?.text ??
      `${company.name} operates in ${company.sector}. Confirm the core revenue engine and unit economics in plain English before sizing a position.`,
    businessModel: [
      `${company.name} sits in ${company.sector}; map the primary revenue line and how it scales.`,
      `Check recurring vs one-off mix and the unit economics behind reported growth.`,
    ],
    moatCompetition: [
      `Assess durable edge vs ${peerList} — patents, switching costs, network effects, or cost structure rivals can't copy.`,
      `Watch for margin erosion that signals a commoditizing position.`,
    ],
    catalysts: [
      `${company.whyNow ?? "Track launches, earnings, regulatory events and partnerships"} — confirm each is funded, not just narrative.`,
      `Look for an upcoming catalyst window in the next 1-2 quarters that could re-rate the multiple.`,
    ],
    asymmetry:
      subject && bestScore !== null
        ? [
            `${ticker} carries a ${subject.valueGrowthScore.toFixed(2)} value/growth score on ${subject.revGrowth}% YoY growth.`,
            subject.valueGrowthScore === bestScore
              ? `That is the cheapest growth in its peer set — a favorable valuation floor.`
              : `Richer than at least one peer, so the growth ceiling has to do the work.`,
          ]
        : [
            `Low valuation floor vs high growth ceiling defines the setup.`,
            `The deep dive must confirm the downside is anchored before the upside matters.`,
          ],
  };

  // These are checks to RUN, not confirmed flags — the fallback has no filings.
  // Severity reflects how much each check typically matters, not a verified finding.
  const redFlags: BearFlag[] = [
    {
      rank: 1,
      severity: "Moderate",
      title: "Customer / revenue concentration (to verify)",
      detail: `Check the latest 10-K for any single customer above 25% of revenue. Concentration in ${company.sector} can swing a quarter and re-rate the multiple fast. Not yet confirmed — needs the filing.`,
      source: "SEC 10-K (concentration footnote)",
      whatWouldDisprove: "Top customer below ~15% of revenue with a diversified, growing logo base.",
    },
    {
      rank: 2,
      severity: "Moderate",
      title: "Margin trend (to verify)",
      detail:
        "Trace gross AND operating margin across the last 4 quarters. A widening GAAP vs non-GAAP gap would be a tell that a headline beat is engineered. Requires live financials to confirm.",
      source: "Earnings releases + transcripts (last 4 Q)",
      whatWouldDisprove: "Stable or expanding gross margin with shrinking GAAP/non-GAAP gap over 4 quarters.",
    },
    {
      rank: 3,
      severity: "Moderate",
      title: "Insider selling & guidance (to verify)",
      detail:
        "Screen Form 4s for unscheduled selling outside a 10b5-1 plan, and check for any guidance cuts in the last 12 months. No live data here — treat as an open question.",
      source: "SEC Form 4 + guidance history",
      whatWouldDisprove: "No off-plan insider selling and a clean or raised guidance track record.",
    },
  ];

  const rows = subjectRows.length
    ? subjectRows
    : [
        {
          ticker,
          isSubject: true,
          psTtm: 0,
          psFwd: 0,
          pFcf: null,
          evEbitda: 0,
          grossMargin: 0,
          revGrowth: 0,
          valueGrowthScore: 0,
        },
      ];

  const peerNote =
    bestScore !== null
      ? `Lowest value/growth score wins — most growth per dollar of valuation. ${
          subject && subject.valueGrowthScore === bestScore
            ? `${ticker} screens cheapest in the set.`
            : `${subjectRows.find((r) => r.valueGrowthScore === bestScore)?.ticker ?? "A peer"} screens cheapest in the set.`
        }`
      : subjectRows.length
        ? `The peer set for ${ticker} (${competitors.join(", ") || "peers"}) is shown, but live P/S, growth and value/growth figures are not connected — pull current numbers before ranking.`
        : "Seed peer data unavailable for this ticker — re-run with explicit competitors.";

  // Verdict discipline: the offline fallback runs WITHOUT a reasoning model, so
  // even with a live snapshot it must not fabricate a strong BUY/AVOID — that is
  // the live Claude path's job. With a thesis or live data it is a WATCHLIST;
  // with neither it is NO_EDGE. It never emits BUY_CANDIDATE or AVOID.
  const hasThesis = Boolean(report) || subjectRows.length > 0 || liveOn;
  const rating: ResearchRating = hasThesis ? "WATCHLIST" : "NO_EDGE";

  const dataGaps = liveOn
    ? [
        "Forward estimates: consensus revenue/EPS and forward P/S vs the live trailing figures above.",
        "Margin trajectory: the last 4 quarters of gross/operating margin, not just the TTM snapshot.",
        "Concentration & insiders: latest 10-K customer concentration and recent Form 4 activity.",
        "Catalyst funding: whether the next catalyst is funded vs narrative, and its timing.",
      ]
    : [
        "Current valuation: live P/S (TTM and forward), P/FCF, and EV/EBITDA — seed figures here are illustrative.",
        "Growth & margins: the last 4 quarters of revenue growth and gross/operating margin trend.",
        "Concentration & insiders: latest 10-K customer concentration and recent Form 4 insider activity.",
        "Guidance: any guidance changes over the last 12 months.",
      ];

  const why = liveOn
    ? `${ticker}: live price/metrics/news are attached (see the market view), but this offline summary doesn't run a reasoning model, so it stays a WATCHLIST. Re-run with the live AI model for a graded BUY_CANDIDATE / AVOID call backed by the live data.`
    : hasThesis
      ? `${ticker}: there is a plausible thesis worth tracking, but with no live market/news/fundamental feed connected this is a WATCHLIST, not a strong call. A BUY or AVOID verdict would require live valuation, current growth, and risk data — see the data gaps below.`
      : `${ticker} is not in the seeded research set and no live data is connected, so there is NO EDGE to act on yet. Pull the live data below before forming a view.`;

  return {
    ticker,
    method: method.key,
    methodName: method.name,
    generatedBy: "mock",
    generatedAt: Date.now(),
    debug,
    live: live ?? null,
    marketView: buildMockMarketView(input),
    deepDive,
    peerValuation: {
      summary: `Relative valuation for ${ticker} vs ${peerList}.${liveOn ? " Live TTM metrics are attached above; the peer grid below is seeded." : " Live figures required — seed values are illustrative."}`,
      columns: PEER_COLUMNS,
      rows,
      note: peerNote,
    },
    bearCase: {
      summary: `Risks to pressure-test for ${ticker}. Without live filings these are the standard checks to run, not confirmed red flags.`,
      redFlags,
    },
    generalVerdict: {
      rating,
      confidence: "Low",
      why,
      keyConditions: [
        ...dataGaps,
        "What would turn this bullish: durable, capital-efficient growth at a reasonable multiple with a funded near-term catalyst.",
        "What would turn this bearish: decelerating growth, margin compression, customer concentration, or a stretched multiple with no funded catalyst.",
      ],
      notFinancialAdvice: true,
    },
  };
}

/** Attempts the live Anthropic Messages API call. Throws on failure (caller falls back). */
async function callClaude(input: GenerateInput): Promise<GeneratedAnalysis> {
  const cred = resolveCredential();
  if (!cred) throw new Error("no-credentials");

  const { system, user } = buildPrompt(input);
  const endpoint = cred.url.replace(/\/$/, "") + "/v1/messages";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  let res: globalThis.Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cred.token,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} (${cred.source}): ${body.slice(0, 200)}`);
  }

  const data: any = await res.json();
  const text: string = Array.isArray(data?.content)
    ? data.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n")
    : "";
  if (!text) throw new Error("empty-response");

  // Extract the JSON object even if wrapped in markdown fences.
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("no-json-in-response");
  const parsed = JSON.parse(jsonMatch[0]);

  // Robustly map the parsed payload onto our structured shape, filling gaps.
  const mockBase = buildMockAnalysis(input);
  const dd = parsed.deepDive ?? {};
  const pv = parsed.peerValuation ?? {};
  const bc = parsed.bearCase ?? {};
  const gv = parsed.generalVerdict ?? {};

  const redFlags: BearFlag[] = Array.isArray(bc.redFlags) && bc.redFlags.length
    ? bc.redFlags.map((f: any, i: number) => ({
        rank: typeof f.rank === "number" ? f.rank : i + 1,
        severity: ["Severe", "High", "Moderate"].includes(f.severity) ? f.severity : "High",
        title: String(f.title ?? "Red flag"),
        detail: String(f.detail ?? ""),
        source: String(f.source ?? ""),
        whatWouldDisprove: String(f.whatWouldDisprove ?? ""),
      }))
    : mockBase.bearCase.redFlags;

  const rows: PeerRow[] = Array.isArray(pv.rows) && pv.rows.length ? pv.rows : mockBase.peerValuation.rows;

  const mv = parsed.marketView ?? {};
  const marketView: MarketViewSection = {
    lean: ["Bullish", "Bearish", "Mixed"].includes(mv.lean) ? mv.lean : mockBase.marketView.lean,
    summary: String(mv.summary ?? mockBase.marketView.summary),
    drivers: asStringArray(mv.drivers, mockBase.marketView.drivers),
  };

  return {
    ticker: input.ticker,
    method: input.method.key,
    methodName: input.method.name,
    generatedBy: "claude",
    model: data?.model ?? CLAUDE_MODEL,
    generatedAt: Date.now(),
    live: input.live ?? null,
    marketView,
    deepDive: {
      summary: String(dd.summary ?? mockBase.deepDive.summary),
      businessModel: asStringArray(dd.businessModel, mockBase.deepDive.businessModel),
      moatCompetition: asStringArray(dd.moatCompetition, mockBase.deepDive.moatCompetition),
      catalysts: asStringArray(dd.catalysts, mockBase.deepDive.catalysts),
      asymmetry: asStringArray(dd.asymmetry, mockBase.deepDive.asymmetry),
    },
    peerValuation: {
      summary: String(pv.summary ?? mockBase.peerValuation.summary),
      columns: PEER_COLUMNS,
      rows,
      note: String(pv.note ?? mockBase.peerValuation.note),
    },
    bearCase: {
      summary: String(bc.summary ?? mockBase.bearCase.summary),
      redFlags,
    },
    generalVerdict: {
      rating: normalizeRating(gv.rating),
      confidence: ["Low", "Medium", "High"].includes(gv.confidence) ? gv.confidence : "Medium",
      why: String(gv.why ?? mockBase.generalVerdict.why),
      keyConditions: asStringArray(gv.keyConditions, mockBase.generalVerdict.keyConditions),
      notFinancialAdvice: true,
    },
  };
}

/** Public entry: live Claude call with graceful mock fallback. */
export async function generateAnalysis(input: GenerateInput): Promise<GeneratedAnalysis> {
  try {
    return await callClaude(input);
  } catch (err) {
    const summary = err instanceof Error ? err.message : String(err);
    // Log server-side for debugging; never crash the request.
    console.error(`[claude] live call failed, using mock: ${summary}`);
    return buildMockAnalysis(input, summary);
  }
}
