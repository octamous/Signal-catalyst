/**
 * Market-impact events — a multi-asset, ForexFactory-inspired event radar.
 * ALL data here is SEEDED / MOCK and non-live. Later this can be wired to a
 * real economic-calendar or news API; for now it returns hand-authored
 * examples so the UI and contract are stable.
 *
 * Each event is written in plain trading/investing language: which symbols are
 * affected, the overall market bias, a concrete bull case, a concrete bear
 * case, the volatility risk, why it matters, and what to watch.
 */
import type { AssetClass, MarketImpactEvent } from "@shared/schema";

// Relative dates so the calendar always looks "upcoming" without a live feed.
function inDays(days: number, hour: number, minute: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, minute, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

function whenLabel(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

type Seed = Omit<MarketImpactEvent, "dateTime" | "whenLabel" | "expectedDirectionBias"> & {
  days: number;
  hour: number;
  minute: number;
};

const SEED: Seed[] = [
  // ---------------- STOCKS ----------------
  {
    id: "stk-nvda-earnings",
    days: 2,
    hour: 20,
    minute: 30,
    assetClass: "stocks",
    eventName: "NVDA earnings (after the close)",
    impactLevel: "High",
    affectedSymbols: ["NVDA", "SMH", "QQQ", "SPY", "AVGO"],
    marketBias: "Volatile",
    volatilityRisk: "High",
    bullCase:
      "Data-center revenue beats and guidance is raised again → the whole AI-compute complex (SMH, AVGO, NVDA suppliers) gaps up and drags QQQ/SPY higher.",
    bearCase:
      "Any soft guidance, gross-margin dip, or 'digestion' commentary → NVDA sells off 8–12% after hours and pulls semis and the index down with it.",
    whyItMatters:
      "NVDA is the largest AI-compute name and a top index weight. Its guidance sets the tone for the entire semiconductor complex and the broad market.",
    whatToWatch:
      "Data-center revenue vs consensus, forward guidance, gross margin, and any comment on next-gen GPU supply/demand. Watch the after-hours move in SMH as the cleanest read-through.",
    sourceLabel: "Company earnings release",
  },
  {
    id: "stk-fomc",
    days: 6,
    hour: 18,
    minute: 0,
    assetClass: "stocks",
    eventName: "FOMC rate decision & Powell press conference",
    impactLevel: "High",
    affectedSymbols: ["SPY", "QQQ", "IWM", "TLT", "BTC"],
    marketBias: "Two-way",
    volatilityRisk: "High",
    bullCase:
      "Dovish hold or a dot-plot signalling cuts → yields fall, rate-sensitive growth (QQQ) and small caps (IWM) rally, risk assets including crypto catch a bid.",
    bearCase:
      "Hawkish tone or fewer cuts penciled in → yields jump, TLT falls, and high-multiple growth + small caps lead a broad de-rate.",
    whyItMatters:
      "The policy rate and Powell's tone set the discount rate for every equity. Rate-sensitive growth and small caps react most violently.",
    whatToWatch:
      "The dot plot, statement language on cuts, and Powell's framing of the inflation/employment balance. Watch the 2-year yield and IWM for the cleanest reaction.",
    sourceLabel: "US Federal Reserve",
  },
  {
    id: "stk-jobs-report",
    days: 3,
    hour: 12,
    minute: 30,
    assetClass: "stocks",
    eventName: "US nonfarm payrolls (monthly jobs report)",
    impactLevel: "High",
    affectedSymbols: ["SPY", "QQQ", "IWM", "DXY"],
    marketBias: "Volatile",
    volatilityRisk: "High",
    bullCase:
      "A soft-but-not-recessionary print (cooling wages, in-line jobs) → rate-cut odds rise, yields ease, and equities rally on the 'soft landing' read.",
    bearCase:
      "A hot payrolls + wage number → 'good news is bad news': rate-cut odds get priced out, yields spike, and growth/small caps sell off.",
    whyItMatters:
      "The headline jobs number and wage growth reshape rate-cut odds. A hot labor market can flip equities lower even on 'strong' data.",
    whatToWatch:
      "Payrolls vs consensus, average hourly earnings, the unemployment rate, and prior-month revisions. Watch the immediate move in the 2-year yield.",
    sourceLabel: "US Bureau of Labor Statistics",
  },
  {
    id: "stk-space-ipo-watch",
    days: 9,
    hour: 14,
    minute: 0,
    assetClass: "stocks",
    eventName: "Space / new-economy IPO & S-1 watch (incl. SpaceX speculation)",
    impactLevel: "Medium",
    affectedSymbols: ["RKLB", "LUNR", "ASTS", "RDW", "ARKX"],
    marketBias: "Volatile",
    volatilityRisk: "High",
    bullCase:
      "A high-profile space S-1 filing (or credible SpaceX listing chatter) re-rates the whole listed-space basket — RKLB/LUNR/ASTS rally on 'scarcity premium' and sector attention.",
    bearCase:
      "A mega space IPO can also drain capital from incumbents: investors rotate out of RKLB/LUNR into the new name, and a weak debut sours sentiment across the basket.",
    whyItMatters:
      "Listed-space names are thin and sentiment-driven. A marquee filing or debut moves the entire basket far more than fundamentals justify in the short term.",
    whatToWatch:
      "SEC EDGAR for any new space-sector S-1/F-1, the listed-space basket's reaction to filing headlines, and first-day float/lockup terms once a deal prices.",
    sourceLabel: "SEC EDGAR + sector newswires",
  },
  {
    id: "stk-megacap-earnings",
    days: 4,
    hour: 20,
    minute: 30,
    assetClass: "stocks",
    eventName: "Mega-cap tech earnings cluster",
    impactLevel: "Medium",
    affectedSymbols: ["SPY", "QQQ", "MSFT", "GOOGL", "META"],
    marketBias: "Volatile",
    volatilityRisk: "Medium",
    bullCase:
      "Strong cloud/ad numbers plus disciplined AI capex commentary → index leaders rally and carry QQQ/SPY even on weak breadth.",
    bearCase:
      "Capex blowouts without revenue to match, or weak guidance → the heaviest index weights sell off and drag the whole tape lower.",
    whyItMatters:
      "A cluster of mega-cap reports in one week can swing index direction given their combined weight, even when market breadth is weak.",
    whatToWatch:
      "Guidance tone across the names, AI-capex commentary, and whether the market rewards beats or sells into them.",
    sourceLabel: "Company earnings releases",
  },

  // ---------------- FX ----------------
  {
    id: "fx-us-cpi",
    days: 2,
    hour: 12,
    minute: 30,
    assetClass: "fx",
    eventName: "US CPI inflation (m/m & y/y)",
    impactLevel: "High",
    affectedSymbols: ["DXY", "EUR/USD", "USD/JPY", "GBP/USD"],
    marketBias: "Volatile",
    volatilityRisk: "High",
    bullCase:
      "A hot core CPI → the dollar (DXY) jumps, EUR/USD and USD/JPY swing hard as rate-cut bets get pushed out.",
    bearCase:
      "A cool print → the dollar drops, EUR/USD rallies, and risk assets get relief as cuts are pulled forward.",
    whyItMatters:
      "Headline and core inflation drive the Fed rate path. CPI is one of the highest-volatility FX events on the calendar.",
    whatToWatch:
      "Core m/m vs consensus, shelter and services components, and the immediate move in the 2-year yield and DXY.",
    sourceLabel: "US Bureau of Labor Statistics",
  },
  {
    id: "fx-ecb-rate",
    days: 4,
    hour: 12,
    minute: 15,
    assetClass: "fx",
    eventName: "ECB rate decision & press conference",
    impactLevel: "High",
    affectedSymbols: ["EUR/USD", "EUR/GBP", "DXY"],
    marketBias: "Two-way",
    volatilityRisk: "Medium",
    bullCase:
      "A hawkish hold or upgraded inflation view → EUR/USD rallies as markets price fewer/later cuts.",
    bearCase:
      "A dovish cut or soft guidance from Lagarde → the euro weakens against the dollar and sterling.",
    whyItMatters:
      "The decision plus Lagarde's tone set the euro's near-term path. Forward guidance usually moves EUR/USD more than the decision itself.",
    whatToWatch:
      "Any deposit-rate change, statement language on future cuts, and Lagarde's data-dependence framing in the presser.",
    sourceLabel: "European Central Bank",
  },
  {
    id: "fx-jobless-claims",
    days: 1,
    hour: 12,
    minute: 30,
    assetClass: "fx",
    eventName: "US initial jobless claims (weekly)",
    impactLevel: "Medium",
    affectedSymbols: ["DXY", "EUR/USD", "USD/JPY"],
    marketBias: "Two-way",
    volatilityRisk: "Low",
    bullCase:
      "A low claims print confirms a resilient labor market → supports the dollar and higher-for-longer rate expectations.",
    bearCase:
      "A sustained rise in claims → cooling-labor read pulls cut expectations forward and weighs on the dollar.",
    whyItMatters:
      "A timely read on the labor market. The trend, not any single week, shifts rate-cut expectations.",
    whatToWatch:
      "The 4-week moving average and continuing claims trend rather than the single weekly figure.",
    sourceLabel: "US Department of Labor",
  },
  {
    id: "fx-ppi",
    days: 3,
    hour: 12,
    minute: 30,
    assetClass: "fx",
    eventName: "US PPI (producer prices)",
    impactLevel: "Medium",
    affectedSymbols: ["DXY", "EUR/USD", "USD/CAD"],
    marketBias: "Volatile",
    volatilityRisk: "Medium",
    bullCase:
      "A hot PPI pre-positions the dollar higher ahead of CPI/PCE as inflation pressure looks sticky.",
    bearCase:
      "A soft PPI eases inflation fear and pressures the dollar into the CPI print.",
    whyItMatters:
      "PPI is a leading indicator for CPI and feeds the Fed's preferred PCE gauge, so it can move the dollar ahead of CPI.",
    whatToWatch:
      "Core PPI and the components that map into PCE (healthcare, portfolio management, airfares).",
    sourceLabel: "US Bureau of Labor Statistics",
  },

  // ---------------- CRYPTO ----------------
  {
    id: "crypto-etf-flows",
    days: 1,
    hour: 21,
    minute: 0,
    assetClass: "crypto",
    eventName: "Spot Bitcoin/Ether ETF net flows (daily)",
    impactLevel: "High",
    affectedSymbols: ["BTC", "ETH", "COIN", "MSTR"],
    marketBias: "Bullish",
    volatilityRisk: "Medium",
    bullCase:
      "A multi-day streak of net inflows → structural demand pushes BTC/ETH higher and lifts COIN and MSTR with them.",
    bearCase:
      "Large net outflows → forced de-risking can cascade across crypto and hit the equity proxies (COIN, MSTR) harder than spot.",
    whyItMatters:
      "Persistent spot-ETF inflows are a structural demand signal; large outflows can trigger sharp de-risking across the asset class.",
    whatToWatch:
      "The multi-day flow trend, IBIT/FBTC share, and whether ETH ETF flows confirm or diverge from BTC.",
    sourceLabel: "ETF issuer flow trackers",
  },
  {
    id: "crypto-fomc-liquidity",
    days: 6,
    hour: 18,
    minute: 0,
    assetClass: "crypto",
    eventName: "FOMC decision — liquidity read-through to crypto",
    impactLevel: "High",
    affectedSymbols: ["BTC", "ETH", "SOL"],
    marketBias: "Two-way",
    volatilityRisk: "High",
    bullCase:
      "A dovish Fed / falling real yields → crypto, as a high-beta liquidity asset, rallies hardest on the risk-on turn.",
    bearCase:
      "A hawkish surprise / rising real yields and DXY → crypto sells off faster than equities given its higher beta.",
    whyItMatters:
      "Crypto trades as a high-beta liquidity asset. The Fed's stance on rates and the balance sheet shapes the risk appetite that drives BTC/ETH.",
    whatToWatch:
      "Dot-plot shifts, balance-sheet/QT commentary, and the move in real yields and DXY immediately after the statement.",
    sourceLabel: "US Federal Reserve",
  },
  {
    id: "crypto-token-unlock",
    days: 3,
    hour: 0,
    minute: 0,
    assetClass: "crypto",
    eventName: "Major token unlock / vesting cliff",
    impactLevel: "High",
    affectedSymbols: ["ARB", "SOL", "ETH"],
    marketBias: "Bearish",
    volatilityRisk: "High",
    bullCase:
      "If demand absorbs the new float (strong narrative, low exchange inflows) → the unlock passes without a dent and shorts get squeezed.",
    bearCase:
      "A large unlock into weak demand → new supply hits the market, exchange inflows spike, and the token drops on the cliff date.",
    whyItMatters:
      "Large scheduled unlocks add circulating supply and can pressure price if demand doesn't absorb the new float, especially for low-float tokens.",
    whatToWatch:
      "Unlock size as a percent of circulating supply, recipient type (team/investor vs ecosystem), and exchange inflows around the date.",
    sourceLabel: "Token vesting schedules",
  },
  {
    id: "crypto-regulatory",
    days: 4,
    hour: 15,
    minute: 0,
    assetClass: "crypto",
    eventName: "Crypto regulatory decision (SEC / court ruling)",
    impactLevel: "High",
    affectedSymbols: ["BTC", "ETH", "COIN", "XRP"],
    marketBias: "Volatile",
    volatilityRisk: "High",
    bullCase:
      "A favorable ruling/approval → the regulatory risk premium falls, COIN re-rates, and the asset class catches a relief bid.",
    bearCase:
      "An enforcement action or adverse ruling → risk premium spikes, COIN and affected tokens drop, and contagion hits sentiment.",
    whyItMatters:
      "Enforcement actions, approvals, or court rulings reset the regulatory risk premium across crypto and can re-rate exchange equities.",
    whatToWatch:
      "Scope of the ruling (token-specific vs industry-wide), appeal risk, and the reaction in COIN as a regulated-venue proxy.",
    sourceLabel: "Regulatory / court filings",
  },
];

function expand(s: Seed): MarketImpactEvent {
  const { days, hour, minute, ...rest } = s;
  return {
    ...rest,
    dateTime: inDays(days, hour, minute),
    whenLabel: whenLabel(days),
    expectedDirectionBias: rest.marketBias,
  };
}

export const seedMarketImpactEvents: MarketImpactEvent[] = SEED.map(expand);

/** Returns the top 5 events for an asset class (or across all), sorted by impact then soonest. */
export function getMarketImpact(assetClass: AssetClass | "all"): MarketImpactEvent[] {
  const impactRank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
  const pool =
    assetClass === "all"
      ? seedMarketImpactEvents
      : seedMarketImpactEvents.filter((e) => e.assetClass === assetClass);
  return [...pool]
    .sort((a, b) => {
      const r = impactRank[a.impactLevel] - impactRank[b.impactLevel];
      if (r !== 0) return r;
      return a.dateTime.localeCompare(b.dateTime);
    })
    .slice(0, 5);
}
