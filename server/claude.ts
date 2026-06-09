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
};

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
  const { ticker, method, competitors, company, peer } = input;
  const peerList = competitors.length ? competitors.join(", ") : "two closest public peers";

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
    ? `\n\nReference peer valuation data (illustrative, may be stale):\n${JSON.stringify(peer.rows)}`
    : "";

  const system =
    "You are a rigorous buy-side alpha analyst hunting mispriced, high-potential equities. " +
    "Be specific, quantitative, and skeptical. This output is a research tool for the user's own " +
    "workflow — it is NOT personalized financial advice. Never tell the user to buy or sell. " +
    "Express conclusions only as a research verdict (BUY_CANDIDATE, WATCHLIST, AVOID, or NO_EDGE) " +
    "with rationale. Respond with a single minified JSON object only — no prose outside the JSON.";

  const user =
    `Run the "${method.name}" 3-step analysis stack on ${ticker} (${company.name}, ${company.sector}) ` +
    `vs ${peerList}.\n\n${steps}${peerContext}\n\n` +
    `Return STRICT JSON matching EXACTLY this TypeScript type and nothing else:\n` +
    `{\n` +
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
    `    "redFlags": { "rank": number, "severity": "Severe"|"High"|"Moderate", "title": string, "detail": string, "source": string, "whatWouldDisprove": string }[]  // 3 flags ranked by severity\n` +
    `  },\n` +
    `  "generalVerdict": {\n` +
    `    "rating": "BUY_CANDIDATE"|"WATCHLIST"|"AVOID"|"NO_EDGE",\n` +
    `    "confidence": "Low"|"Medium"|"High",\n` +
    `    "why": string,\n` +
    `    "keyConditions": string[],   // 2-4 conditions that would change the verdict\n` +
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

/** Deterministic, polished fallback derived from seeded data. */
export function buildMockAnalysis(input: GenerateInput, debug?: string): GeneratedAnalysis {
  const { ticker, method, company, report, peer, competitors } = input;
  const subjectRows = peer?.rows ?? [];
  const bestScore = subjectRows.length
    ? Math.min(...subjectRows.map((r) => r.valueGrowthScore))
    : null;
  const subject = subjectRows.find((r) => r.isSubject);
  const peerList = competitors.join(", ") || "closest peers";

  const deepDive = {
    summary:
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

  const redFlags: BearFlag[] = [
    {
      rank: 1,
      severity: company.riskLevel === "Very high" ? "Severe" : "High",
      title: "Customer / revenue concentration",
      detail: `Check the latest 10-K for any single customer above 25% of revenue. Concentration in ${company.sector} can swing a quarter and re-rate the multiple fast.`,
      source: "SEC 10-K (concentration footnote)",
      whatWouldDisprove: "Top customer below ~15% of revenue with a diversified, growing logo base.",
    },
    {
      rank: 2,
      severity: "High",
      title: "Margin compression",
      detail:
        "Trace gross AND operating margin across the last 4 quarters. A widening GAAP vs non-GAAP gap is the tell that the headline beat is engineered.",
      source: "Earnings releases + transcripts (last 4 Q)",
      whatWouldDisprove: "Stable or expanding gross margin with shrinking GAAP/non-GAAP gap over 4 quarters.",
    },
    {
      rank: 3,
      severity: "Moderate",
      title: "Insider selling & guidance",
      detail:
        "Screen Form 4s for unscheduled selling outside a 10b5-1 plan, and check for any guidance cuts in the last 12 months.",
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
      : "Seed peer data unavailable for this ticker — re-run with explicit competitors.";

  // Map the seeded recommendedAction onto a research verdict.
  let rating: ResearchRating = "WATCHLIST";
  if (report?.recommendedAction) {
    const a = report.recommendedAction.toLowerCase();
    if (a.includes("avoid") || a.includes("pass")) rating = "AVOID";
    else if (a.includes("watch")) rating = "WATCHLIST";
    else if (a.includes("candidate") || a.includes("research") || a.includes("buy")) rating = "BUY_CANDIDATE";
  } else {
    rating = company.score >= 75 ? "BUY_CANDIDATE" : company.score >= 55 ? "WATCHLIST" : "NO_EDGE";
  }

  return {
    ticker,
    method: method.key,
    methodName: method.name,
    generatedBy: "mock",
    generatedAt: Date.now(),
    debug,
    deepDive,
    peerValuation: {
      summary: `Relative valuation for ${ticker} vs ${peerList}.`,
      columns: PEER_COLUMNS,
      rows,
      note: peerNote,
    },
    bearCase: {
      summary: `Top red flags to disprove before committing capital to ${ticker}.`,
      redFlags,
    },
    generalVerdict: {
      rating,
      confidence: company.score >= 75 ? "Medium" : "Low",
      why:
        rating === "AVOID"
          ? `${ticker}: the bear case currently outweighs the asymmetry — no clear edge.`
          : rating === "BUY_CANDIDATE"
            ? `${ticker}: live research candidate — valuation/growth screens favorably but run the bear case hard first.`
            : `${ticker}: optionality bet — keep it on the radar, size small until the evidence firms up.`,
      keyConditions: [
        "Confirm no single-customer concentration above ~25% of revenue.",
        "Verify the next catalyst is funded, not just narrative.",
        "Watch gross/operating margin trend across the next two prints.",
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

  return {
    ticker: input.ticker,
    method: input.method.key,
    methodName: input.method.name,
    generatedBy: "claude",
    model: data?.model ?? CLAUDE_MODEL,
    generatedAt: Date.now(),
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
