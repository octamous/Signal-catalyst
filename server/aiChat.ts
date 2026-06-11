/**
 * Built-in AI research chat for Signal Catalyst.
 *
 * A conversational finance-research assistant scoped to this app: stocks,
 * catalysts, market-impact events, IPOs, risk checks, valuation questions,
 * peer comparisons, and watchlist reasoning.
 *
 * Secrets stay server-side. It reuses the exact same credential resolution and
 * model selection as server/claude.ts (ANTHROPIC_API_KEY/ANTHROPIC_BASE_URL/
 * ANTHROPIC_MODEL first, then the Perplexity secure-credential proxies). If no
 * credentials are configured, or the live call fails for any reason, it returns
 * a useful, deterministic fallback flagged `generatedBy: 'mock'` — it never
 * crashes the request.
 *
 * IMPORTANT: this app has NO live market/news/filings/calendar data wired in.
 * The assistant must never pretend to have live data. For questions about
 * current or upcoming events (e.g. a possible SpaceX IPO), it must say what
 * live sources it would need and provide a research checklist + what to monitor.
 */
import type { AiChatContext, AiChatResponse, LiveMarketData } from "@shared/schema";
import { CLAUDE_MODEL, resolveCredential } from "./claude";
import { seedMarketImpactEvents } from "./marketImpact";

export const AI_DISCLAIMER =
  "Research and analysis only, not personalized financial advice. " +
  "Verify against primary sources and consult a qualified financial advisor before making investment decisions.";

type ChatInput = {
  message: string;
  context?: AiChatContext;
  /** Compact summary of the seeded company/peer/method context for the model. */
  appContext?: string;
  /** Normalized Finnhub snapshot for the selected ticker, if any. */
  live?: LiveMarketData | null;
};

/** True when the chat live snapshot carries usable live figures/headlines. */
function liveHasSignal(live?: LiveMarketData | null): boolean {
  return Boolean(
    live && live.dataStatus === "live" && (live.quote || live.metrics || live.profile || live.companyNews.length),
  );
}

/** Compact live-context block for the chat prompt. */
function renderChatLive(live?: LiveMarketData | null): string {
  if (!liveHasSignal(live) || !live) return "";
  const lines: string[] = ["LIVE DATA (Finnhub) for the selected ticker:"];
  if (live.profile) lines.push(`- ${live.profile.name} (${live.resolvedSymbol}), ${live.profile.industry || "industry n/a"}.`);
  if (live.quote)
    lines.push(
      `- Quote: ${live.quote.current} (${live.quote.percentChange >= 0 ? "+" : ""}${live.quote.percentChange.toFixed(2)}% vs prev close ${live.quote.previousClose}).`,
    );
  if (live.metrics)
    lines.push(
      `- Metrics TTM: P/S ${live.metrics.psTtm ?? "n/a"}, P/E ${live.metrics.peTtm ?? "n/a"}, rev growth ${live.metrics.revenueGrowthTtmYoy ?? "n/a"}%, gross margin ${live.metrics.grossMarginTtm ?? "n/a"}%.`,
    );
  if (live.companyNews.length)
    lines.push(`- Recent headlines:\n${live.companyNews.slice(0, 5).map((n) => `  • ${n.headline} (${n.source})`).join("\n")}`);
  return lines.join("\n");
}

/** Builds the finance-research system prompt, embedding app context. */
function buildSystemPrompt(input: ChatInput): string {
  const { context, appContext, live } = input;
  const liveOn = liveHasSignal(live);
  const liveBlock = renderChatLive(live);

  // A concise digest of the seeded market-impact catalog so the model can
  // reason about the kinds of events this app tracks — clearly flagged seeded.
  const eventDigest = seedMarketImpactEvents
    .slice(0, 8)
    .map((e) => `- [${e.assetClass.toUpperCase()} · ${e.impactLevel}] ${e.eventName} (${e.affectedSymbols.join(", ")})`)
    .join("\n");

  const tickerLine = context?.selectedTicker
    ? `The user currently has ticker ${context.selectedTicker} selected in the dashboard.`
    : "No specific ticker is selected right now.";
  const methodLine = context?.method
    ? `The active analysis method is the "${context.method}" 3-step stack (deep dive → peer valuation → bear case → research verdict).`
    : "";

  return [
    "You are the built-in AI research analyst inside Signal Catalyst, a dark-themed alpha research dashboard",
    "for a sophisticated retail investor hunting high-potential stocks and understanding market-moving events.",
    "Your job: give practical, useful market-impact and scenario analysis on equities, catalysts, IPOs, valuation,",
    "peer comparisons, and watchlist reasoning.",
    "",
    "STYLE: Be specific, quantitative, and skeptical, like a sharp buy-side analyst. Use short paragraphs and tight",
    "bullet lists. Lead with the useful answer, not with disclaimers. When relevant, end with a one-line research",
    "verdict using the app's verdict language — BUY CANDIDATE, WATCHLIST, AVOID, or NO EDGE — phrased as a research",
    "conclusion, never as a personal instruction to buy or sell.",
    "",
    "HOW TO ANSWER MARKET-IMPACT / EVENT / IPO QUESTIONS (this is the core job):",
    "Always give a genuinely useful scenario answer FIRST, even without live data. Structure it as:",
    "  a) Likely direct market effects of the event.",
    "  b) Affected public tickers and sectors (name real, plausible ones — e.g. for a SpaceX IPO: RKLB, LUNR, ASTS,",
    "     BKSY, RDW, defense/aerospace ETFs like ITA/ARKX, and possible TSLA sentiment spillover).",
    "  c) A bull scenario and a bear scenario, concretely.",
    "  d) What would increase vs decrease the impact, and WHY.",
    "  e) What to watch before and after the event.",
    "  f) A SHORT caveat at the end that live timing/filings/prices need live sources (SEC EDGAR, newswires,",
    "     an economic calendar) — one or two sentences, not the whole answer.",
    "",
    "HARD RULES:",
    liveOn
      ? "1. You HAVE a live Finnhub snapshot (quote / metrics / recent headlines) for the selected ticker below. Use those"
        + " specific numbers and headlines directly and cite them. For anything not in the snapshot (exact future dates,"
        + " intraday flows), reason qualitatively and say it needs live sources."
      : "1. You do NOT have live prices, quotes, real-time flows, exact dates, or 'today's' figures. Never invent them or"
        + " pretend to have browsed. But DO reason qualitatively about mechanics, scenarios, and which tickers/sectors react.",
    "2. Prefer practical market-impact analysis and actionable research checkpoints over generic disclaimers. Do NOT",
    "   answer an event question with only 'I don't have live data' and a list of sources — that is a failure.",
    "3. This is a research tool, not advice. Never give personalized financial advice or tell the user to buy/sell.",
    "   Frame conclusions as research verdicts with the conditions that would change them.",
    "",
    liveOn ? liveBlock : "",
    "",
    "APP CONTEXT (seeded / illustrative unless the live block above says otherwise):",
    tickerLine,
    methodLine,
    appContext ? `\nSeeded data available for the current subject:\n${appContext}` : "",
    "\nThe app tracks these kinds of seeded market-impact events (illustrative, non-live):",
    eventDigest,
    "",
    `Always treat the following as your governing disclaimer: ${AI_DISCLAIMER}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Attempts the live Anthropic Messages API call. Throws on failure. */
async function callClaudeChat(input: ChatInput): Promise<AiChatResponse> {
  const cred = resolveCredential();
  if (!cred) throw new Error("no-credentials");

  const system = buildSystemPrompt(input);
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
        max_tokens: 1600,
        system,
        messages: [{ role: "user", content: input.message }],
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
    ? data.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n").trim()
    : "";
  if (!text) throw new Error("empty-response");

  return {
    reply: text,
    generatedBy: "claude",
    model: data?.model ?? CLAUDE_MODEL,
    liveData: liveHasSignal(input.live),
    liveStatus: input.live?.dataStatus,
    disclaimer: AI_DISCLAIMER,
    generatedAt: Date.now(),
  };
}

/**
 * Deterministic, useful offline fallback. Tailors a research checklist to the
 * detected intent (IPO, weekly mover, peer comparison, single-ticker dive).
 */
export function buildMockChat(input: ChatInput, debug?: string): AiChatResponse {
  const msg = input.message.trim();
  const lower = msg.toLowerCase();
  const ticker = input.context?.selectedTicker;
  const method = input.context?.method ?? "alpha";

  const note =
    "_Offline fallback (no live AI model configured). Scenario analysis below is qualitative; live timing, " +
    "prices and filings need live sources._";

  let body: string;

  if (/(ipo|s-1|s1|go public|going public|direct listing|spac)/.test(lower)) {
    const isSpaceX = /spacex|space x|starlink/.test(lower);
    const name = isSpaceX ? "SpaceX" : "this company";
    if (isSpaceX) {
      body = [
        "**SpaceX IPO — likely market impact and how to play the read-through**",
        "There's no public registration on file, so treat timing as speculative — but the *market impact* of a real SpaceX IPO (or a Starlink carve-out, the more likely first step) is very analysable.",
        "",
        "**a) Likely direct market effects**",
        "- A mega-cap space pure-play would set a fresh valuation anchor for the whole sector — every listed space name gets re-rated against SpaceX's implied multiple.",
        "- A large deal soaks up capital and index/ETF demand, which can pull flows *toward* the leader and *away* from weaker small-caps (a 'flight to the franchise').",
        "- Huge headline and options volume; expect a volatility spike across the complex around any S-1, pricing range, and first-trade date.",
        "",
        "**b) Affected public tickers & sectors**",
        "- **Launch / space infra:** RKLB (Rocket Lab) — closest listed comp and biggest sentiment beneficiary.",
        "- **Lunar / payloads:** LUNR (Intuitive Machines), RDW (Redwire).",
        "- **Space connectivity (Starlink reads):** ASTS (AST SpaceMobile), BKSY (BlackSky).",
        "- **ETFs:** ITA (aerospace & defense), ARKX / UFO (space-themed) — the cleanest way to express the sector beta.",
        "- **Sentiment spillover:** TSLA (shared Musk halo / liquidity-event narrative), and legacy primes (LMT, BA) as the 'old space' relative-value other side.",
        "",
        "**c) Bull scenario**",
        "A premium-priced, well-subscribed IPO validates space economics → RKLB and the ARKX basket re-rate higher, Starlink's disclosed subscriber/ARPU numbers de-risk the connectivity story (ASTS), and capital floods into the theme.",
        "",
        "**d) Bear scenario**",
        "A soft or repeatedly delayed deal, a punchy valuation that breaks below issue, or weak Starlink unit economics → the whole complex de-rates and SpaceX vacuums up the limited sector capital, starving small-caps (RKLB/LUNR/RDW underperform).",
        "",
        "**e) What increases vs decreases the impact (and why)**",
        "- *Increases:* Starlink financials broken out (first hard look at the cash engine), a huge float/index inclusion, and a friendly macro/liquidity backdrop that supports high-multiple IPOs.",
        "- *Decreases:* a tiny float or dual-class lock-up (less tradable supply, weaker read-through), risk-off macro, or management signalling no near-term intent.",
        "",
        "**f) What to watch — before and after**",
        "- *Before:* an S-1 / DRS on SEC EDGAR, named bookrunners, any disclosed Starlink segment numbers, secondary-market / tender valuations, and a price range (424B).",
        "- *After:* first-day pop vs issue, how RKLB/ASTS/ARKX trade *relative* to it, lock-up expiry dates, and the first earnings print that reveals Starlink margins.",
        "",
        "_Caveat: there is no confirmed SpaceX S-1; timing and any figures must be confirmed against SEC EDGAR and primary newswires._",
        "",
        "**Research verdict:** WATCHLIST the listed read-throughs (RKLB, ASTS, ARKX) as the tradable expression — NO EDGE on SpaceX itself until a registration statement exists.",
      ].join("\n");
    } else {
      body = [
        `**${name} IPO — likely market impact and what to watch**`,
        "**Direct effects:** a new listing re-anchors valuation for its closest peers and can pull ETF/index flows toward the leader; expect a volatility spike around the S-1, price range, and first-trade date.",
        "**Affected names:** the closest listed comps in the same sub-sector (they get re-rated to the IPO multiple) and any thematic ETF that would add it.",
        "**Bull:** premium pricing + strong book validates the category and re-rates peers higher.",
        "**Bear:** a soft deal or break-below-issue de-rates the group and drains sector capital into the new name.",
        "**Increases impact:** big float / index inclusion, clean disclosed financials, risk-on macro. **Decreases:** tiny float, lock-ups, risk-off tape.",
        "**Watch — before:** an S-1 / F-1 / DRS on SEC EDGAR, named underwriters, audited financials, price range. **After:** first-day move, peer relative reaction, lock-up expiries.",
        "",
        "_Caveat: confirm any filing and timing against SEC EDGAR and primary newswires._",
        "",
        "**Research verdict:** WATCHLIST the listed peers as the tradable read-through; NO EDGE on the issuer itself pre-registration.",
      ].join("\n");
    }
  } else if (/(this week|today|right now|move|catalyst|what could move)/.test(lower)) {
    const asset = /btc|bitcoin/.test(lower) ? "BTC" : /eth|ether/.test(lower) ? "ETH" : ticker || "this asset";
    body = [
      `**What could move ${asset} near-term**`,
      "I can't see live prices or this week's exact calendar, so confirm dates against a live economic-events calendar. Typical high-impact drivers:",
      "",
      "- **Macro liquidity:** FOMC decisions, CPI/PPI prints, and real-yield / DXY moves — crypto and high-multiple growth trade as liquidity-beta.",
      "- **Flows:** Spot ETF net flows (for BTC/ETH), and large unlocks / vesting cliffs for tokens.",
      "- **Positioning:** Funding-rate extremes and dense liquidation clusters that can cascade either way.",
      "- **Idiosyncratic:** Earnings (for equities), regulatory or court rulings, and headline risk.",
      "",
      "**Research checklist:** Pull the actual dates/times for the week, the consensus vs. prior for each print, and current positioning data.",
      "**What to monitor:** the macro print reactions in yields and DXY, ETF flow trackers, and funding/liquidation heatmaps.",
      "",
      "**Research verdict:** Treat the week as event-driven — size to the volatility, not to a directional guess.",
    ].join("\n");
  } else if (/( vs | versus |compare|comparison)/.test(lower)) {
    body = [
      "**Peer comparison framework**",
      "Compare the names on the app's value/growth lens rather than headline multiples alone:",
      "",
      "- **Valuation:** P/S TTM and forward, P/FCF, EV/EBITDA.",
      "- **Growth & quality:** YoY revenue growth, gross margin trend, operating leverage.",
      "- **Value/Growth score:** P/S TTM ÷ revenue growth % — lower means more growth per dollar of valuation.",
      "- **Bear case parity:** Run the same red-flag checklist (customer concentration, margin compression, insider selling) on both.",
      "",
      "**Research checklist:** Pull the latest filed financials for each name (they can be stale near earnings), then rank by value/growth and overlay the bear case.",
      "**What to monitor:** the next earnings prints and any guidance revisions.",
      "",
      "**Research verdict:** WATCHLIST the cheaper-growth name; AVOID the one whose bear case isn't disproven.",
    ].join("\n");
  } else if (ticker || /alpha method|deep dive/.test(lower)) {
    const t = ticker || "the subject";
    body = [
      `**Running the ${method} method framework on ${t}**`,
      "The app's 3-step stack:",
      "",
      "1. **Deep dive:** Business model and unit economics, durable moat vs. peers, funded catalysts in the next 1–2 quarters, and the asymmetry (valuation floor vs. growth ceiling).",
      "2. **Peer valuation:** Place it on the value/growth grid vs. its closest public peers.",
      "3. **Bear case:** Rank the top red flags by severity and state what would disprove each.",
      "",
      "I don't have live financials wired in, so confirm the numbers against the latest filings.",
      "**What to monitor:** next earnings, margin trend, and whether the lead catalyst is funded vs. narrative.",
      "",
      "**Research verdict:** WATCHLIST pending confirmation of the catalyst and a clean bear-case check.",
    ].join("\n");
  } else {
    body = [
      "**Research framing**",
      "I'm a finance-research assistant for this dashboard — ask me about a ticker, a catalyst or market-impact event, an IPO, a risk check, a valuation question, a peer comparison, or watchlist reasoning.",
      "",
      "I don't have live data connected, so for anything time-sensitive I'll tell you which live sources to pull and give you a research checklist plus what to monitor.",
      "",
      "Try: \"Analyze RKLB using the alpha method\", \"What could move BTC this week?\", \"What would need to happen before a SpaceX IPO?\", or \"Compare NBIS vs CRDO\".",
    ].join("\n");
  }

  // If a live snapshot is attached, surface it up top so even the offline
  // fallback shows the real quote/metrics rather than only qualitative scenarios.
  const liveOn = liveHasSignal(input.live);
  const liveBlock = liveOn ? `${renderChatLive(input.live)}\n` : "";

  return {
    reply: `${note}\n\n${liveBlock}${body}`,
    generatedBy: "mock",
    liveData: liveOn,
    liveStatus: input.live?.dataStatus,
    disclaimer: AI_DISCLAIMER,
    generatedAt: Date.now(),
    debug,
  };
}

/** Public entry: live Claude chat with graceful mock fallback. */
export async function chatWithAnalyst(input: ChatInput): Promise<AiChatResponse> {
  try {
    return await callClaudeChat(input);
  } catch (err) {
    const summary = err instanceof Error ? err.message : String(err);
    console.error(`[ai-chat] live call failed, using mock: ${summary}`);
    return buildMockChat(input, summary);
  }
}
