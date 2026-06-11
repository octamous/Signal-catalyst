/**
 * Seed / mock dataset for the Signal Catalyst MVP skeleton.
 * No live finance APIs — all values are illustrative and hand-authored.
 */

export const seedCompanies = [
  {
    ticker: "RKLB",
    name: "Rocket Lab USA",
    exchange: "NASDAQ",
    country: "United States",
    currency: "USD",
    sector: "Space systems",
    marketCap: "$9.8B",
    matchReason: "Exact company match",
    riskLevel: "High",
    score: 82,
    theme: "Space systems",
    whyNow: "Contract backlog + launch cadence",
    isCandidate: true,
  },
  {
    ticker: "AML",
    name: "Aston Martin Lagonda",
    exchange: "LSE",
    country: "United Kingdom",
    currency: "GBX",
    sector: "Luxury automotive",
    marketCap: "£1.4B",
    matchReason: "Name match, UK listing",
    riskLevel: "High",
    score: 58,
    theme: "Luxury turnaround",
    whyNow: "Brand strength vs balance-sheet strain",
    isCandidate: false,
  },
  {
    ticker: "PLTR",
    name: "Palantir Technologies",
    exchange: "NYSE",
    country: "United States",
    currency: "USD",
    sector: "AI software",
    marketCap: "$214B",
    matchReason: "Ticker or company match",
    riskLevel: "Medium",
    score: 69,
    theme: "AI software",
    whyNow: "Commercial AIP adoption accelerating",
    isCandidate: true,
  },
  {
    ticker: "IONQ",
    name: "IonQ",
    exchange: "NYSE",
    country: "United States",
    currency: "USD",
    sector: "Quantum computing",
    marketCap: "$8.1B",
    matchReason: "Ticker match",
    riskLevel: "Very high",
    score: 74,
    theme: "Quantum",
    whyNow: "Commercial bookings inflection",
    isCandidate: true,
  },
  {
    ticker: "SOUN",
    name: "SoundHound AI",
    exchange: "NASDAQ",
    country: "United States",
    currency: "USD",
    sector: "AI voice",
    marketCap: "$3.6B",
    matchReason: "Ticker match",
    riskLevel: "Very high",
    score: 67,
    theme: "AI voice",
    whyNow: "Enterprise pilots converting",
    isCandidate: true,
  },
  {
    ticker: "HIMS",
    name: "Hims & Hers Health",
    exchange: "NYSE",
    country: "United States",
    currency: "USD",
    sector: "Health platform",
    marketCap: "$6.2B",
    matchReason: "Name or ticker match",
    riskLevel: "Medium",
    score: 79,
    theme: "Health platform",
    whyNow: "Margin expansion + category growth",
    isCandidate: true,
  },
  {
    ticker: "RR",
    name: "Rolls-Royce Holdings",
    exchange: "LSE",
    country: "United Kingdom",
    currency: "GBX",
    sector: "Aerospace",
    marketCap: "£42B",
    matchReason: "Name match, UK listing",
    riskLevel: "Medium",
    score: 77,
    theme: "Aerospace",
    whyNow: "Turnaround + defence tailwinds",
    isCandidate: true,
  },
  {
    ticker: "NBIS",
    name: "Nebius Group",
    exchange: "NASDAQ",
    country: "Netherlands",
    currency: "USD",
    sector: "AI infrastructure",
    marketCap: "$5.4B",
    matchReason: "Discovery candidate",
    riskLevel: "High",
    score: 81,
    theme: "AI infra / neocloud",
    whyNow: "GPU capacity ramp under-followed post-spinoff",
    isCandidate: true,
  },
  {
    ticker: "CRDO",
    name: "Credo Technology",
    exchange: "NASDAQ",
    country: "United States",
    currency: "USD",
    sector: "Semis / connectivity",
    marketCap: "$11.2B",
    matchReason: "Discovery candidate",
    riskLevel: "High",
    score: 80,
    theme: "AI datacenter connectivity",
    whyNow: "Active-electrical-cable design wins inflecting",
    isCandidate: true,
  },
  ...broadUniverse(),
];

/**
 * Broader practical universe of common growth / AI / fintwit tickers so search
 * is not limited to the hand-authored deep-dive set. These carry lighter
 * metadata (no seeded report) — the analysis pipeline still works for them via
 * the deterministic fallback. They are NOT discovery candidates (isCandidate:false)
 * so the curated "overlooked names" strip stays focused.
 *
 * Scores here are neutral (set to 0) on purpose: the app has no live data, so a
 * fabricated "score" would be a false signal. The UI shows "—" for a 0 score.
 */
type SeedCompany = {
  ticker: string;
  name: string;
  exchange: string;
  country: string;
  currency: string;
  sector: string;
  marketCap: string;
  matchReason: string;
  riskLevel: string;
  score: number;
  theme: string | null;
  whyNow: string | null;
  isCandidate: boolean;
};

function u(
  ticker: string,
  name: string,
  sector: string,
  riskLevel: string,
  opts: Partial<SeedCompany> = {},
): SeedCompany {
  return {
    ticker,
    name,
    exchange: opts.exchange ?? "NASDAQ",
    country: opts.country ?? "United States",
    currency: opts.currency ?? "USD",
    sector,
    marketCap: opts.marketCap ?? "—",
    matchReason: "Universe match",
    riskLevel,
    score: opts.score ?? 0,
    theme: opts.theme ?? sector,
    whyNow: opts.whyNow ?? null,
    isCandidate: false,
  };
}

function broadUniverse(): SeedCompany[] {
  return [
    u("SOFI", "SoFi Technologies", "Fintech / digital bank", "High", { theme: "Fintech / digital bank", whyNow: "Bank-charter lending + fee-income mix shift" }),
    u("TSLA", "Tesla", "EV / energy", "High"),
    u("NVDA", "NVIDIA", "Semiconductors", "Medium"),
    u("AMD", "Advanced Micro Devices", "Semiconductors", "Medium"),
    u("META", "Meta Platforms", "Internet / ads", "Medium"),
    u("GOOGL", "Alphabet", "Internet / ads", "Low"),
    u("MSFT", "Microsoft", "Software / cloud", "Low"),
    u("AAPL", "Apple", "Consumer hardware", "Low"),
    u("AMZN", "Amazon", "E-commerce / cloud", "Low"),
    u("COIN", "Coinbase Global", "Crypto exchange", "High"),
    u("HOOD", "Robinhood Markets", "Fintech / brokerage", "High"),
    u("RIVN", "Rivian Automotive", "EV", "Very high"),
    u("UBER", "Uber Technologies", "Mobility / delivery", "Medium"),
    u("CRWD", "CrowdStrike Holdings", "Cybersecurity", "Medium"),
    u("SNOW", "Snowflake", "Data cloud", "Medium"),
    u("NET", "Cloudflare", "Edge / network software", "Medium"),
    u("DDOG", "Datadog", "Observability software", "Medium"),
    u("SHOP", "Shopify", "E-commerce software", "Medium"),
    u("SQ", "Block", "Fintech / payments", "High", { theme: "Payments + Bitcoin", whyNow: "Cash App monetization vs Square seller mix" }),
    u("AFRM", "Affirm Holdings", "Fintech / BNPL", "High"),
    u("APP", "AppLovin", "Adtech / mobile", "High"),
    u("ARM", "Arm Holdings", "Semiconductors / IP", "Medium"),
    u("SMCI", "Super Micro Computer", "AI servers", "Very high"),
    u("ASTS", "AST SpaceMobile", "Space connectivity", "Very high"),
    u("LUNR", "Intuitive Machines", "Lunar / space", "Very high"),
  ];
}

const now = Date.now();

export const seedReports = [
  {
    ticker: "RKLB",
    deepDive: JSON.stringify([
      { title: "Business model", text: "Launch services plus a growing space-systems segment selling satellites, components, and subsystems. Revenue mixes lumpy launch contracts with recurring hardware." },
      { title: "Moat and competition", text: "One of few western small-launch providers with a flight-proven vehicle. Competes with SpaceX rideshare on price and cadence; differentiates on dedicated orbits." },
      { title: "Asymmetry check", text: "Neutron medium-lift could re-rate the company if it flies on schedule. Downside anchored by the existing systems backlog; upside depends on execution." },
    ]),
    skepticReport: JSON.stringify([
      { title: "Dilution risk", text: "Capital-intensive Neutron development means cash burn and possible equity raises until medium-lift revenue scales." },
      { title: "Accounting and customer risk", text: "Launch revenue is lumpy and concentrated in a handful of customers; a slipped manifest can swing a quarter materially." },
      { title: "Hype detector", text: "Space is a narrative-heavy sector. Score weights flight-proven cadence over press releases and renderings." },
    ]),
    portfolioFit: JSON.stringify({
      band: "Satellite / speculative",
      diversification: "Adds aerospace exposure; concentrates if held alongside other pre-profit space names.",
      learning: "Edge case: backlog quality and cash runway gate the re-rate. Track funded vs narrative milestones."
    }),
    scoreBreakdown: JSON.stringify([
      { label: "Catalyst strength", value: 84 },
      { label: "Evidence quality", value: 80 },
      { label: "Balance-sheet safety", value: 62 },
      { label: "Hype discount", value: 70 },
    ]),
    catalystStrength: "Strong",
    hypeRisk: "Elevated",
    recommendedAction: "Research",
    sectorBotKey: "defence",
    updatedAt: now,
  },
  {
    ticker: "PLTR",
    deepDive: JSON.stringify([
      { title: "Business model", text: "Sells data-integration and AI software (Gotham, Foundry, AIP) to governments and enterprises on multi-year contracts." },
      { title: "Moat and competition", text: "Deep deployment lock-in and security accreditation create switching costs; competes with in-house builds and cloud-native data platforms." },
      { title: "Asymmetry check", text: "Commercial AIP bootcamps are converting to paid seats. Valuation already prices in strong growth, compressing the margin of safety." },
    ]),
    skepticReport: JSON.stringify([
      { title: "Dilution risk", text: "Stock-based compensation is high; share count growth dilutes per-share economics even as the business grows." },
      { title: "Accounting and customer risk", text: "Government revenue concentration and deal timing create quarter-to-quarter variability." },
      { title: "Hype detector", text: "AI labelling drives sentiment. Score separates booked commercial revenue from pipeline enthusiasm." },
    ]),
    portfolioFit: JSON.stringify({
      band: "Satellite",
      diversification: "Adds enterprise-software exposure; overlaps with other AI-themed holdings.",
      learning: "Rich multiple compresses margin of safety. Demand booked commercial revenue, not pipeline."
    }),
    scoreBreakdown: JSON.stringify([
      { label: "Catalyst strength", value: 72 },
      { label: "Evidence quality", value: 78 },
      { label: "Balance-sheet safety", value: 80 },
      { label: "Hype discount", value: 52 },
    ]),
    catalystStrength: "Moderate",
    hypeRisk: "High",
    recommendedAction: "Research",
    sectorBotKey: "saas",
    updatedAt: now,
  },
  {
    ticker: "HIMS",
    deepDive: JSON.stringify([
      { title: "Business model", text: "Direct-to-consumer telehealth subscription platform across dermatology, sexual health, weight, and mental health categories." },
      { title: "Moat and competition", text: "Brand and repeat-purchase data create an edge; competes with other DTC health brands and traditional pharmacy." },
      { title: "Asymmetry check", text: "Subscriber growth plus improving gross margin supports a profitable-growth narrative if marketing efficiency holds." },
    ]),
    skepticReport: JSON.stringify([
      { title: "Dilution risk", text: "Lower capital intensity than hardware names, but reliant on continued marketing spend to sustain growth." },
      { title: "Accounting and customer risk", text: "Subscription churn and regulatory shifts in compounded medications are the key watch items." },
      { title: "Hype detector", text: "Weight-loss category buzz can inflate sentiment; score weights cohort retention over headlines." },
    ]),
    portfolioFit: JSON.stringify({
      band: "Core-adjacent / satellite",
      diversification: "Adds consumer-health exposure distinct from tech-heavy holdings.",
      learning: "Best value/growth score in the set. Cohort retention and CAC payback drive the thesis."
    }),
    scoreBreakdown: JSON.stringify([
      { label: "Catalyst strength", value: 76 },
      { label: "Evidence quality", value: 82 },
      { label: "Balance-sheet safety", value: 78 },
      { label: "Hype discount", value: 68 },
    ]),
    catalystStrength: "Moderate",
    hypeRisk: "Medium",
    recommendedAction: "Research",
    sectorBotKey: "biotech",
    updatedAt: now,
  },
  {
    ticker: "IONQ",
    deepDive: JSON.stringify([
      { title: "Business model", text: "Builds trapped-ion quantum computers and sells access via cloud providers plus direct systems sales." },
      { title: "Moat and competition", text: "Differentiated trapped-ion architecture; competes with superconducting and photonic approaches that may scale differently." },
      { title: "Asymmetry check", text: "Early commercial bookings hint at demand, but useful fault-tolerant quantum advantage remains years out." },
    ]),
    skepticReport: JSON.stringify([
      { title: "Dilution risk", text: "Pre-profit and research-heavy; ongoing capital needs make dilution likely." },
      { title: "Accounting and customer risk", text: "Bookings are small and lumpy; revenue recognition timing matters a lot at this scale." },
      { title: "Hype detector", text: "Quantum is one of the most narrative-driven sectors; the score heavily discounts unproven claims." },
    ]),
    portfolioFit: JSON.stringify({
      band: "Speculative / very high risk",
      diversification: "Adds deep-tech optionality; should stay a small position.",
      learning: "Pure optionality bet. Size small — fundamentals are immature and dilution is likely."
    }),
    scoreBreakdown: JSON.stringify([
      { label: "Catalyst strength", value: 78 },
      { label: "Evidence quality", value: 60 },
      { label: "Balance-sheet safety", value: 64 },
      { label: "Hype discount", value: 48 },
    ]),
    catalystStrength: "Strong",
    hypeRisk: "Very high",
    recommendedAction: "Watch only",
    sectorBotKey: "semis",
    updatedAt: now,
  },
  {
    ticker: "SOFI",
    deepDive: JSON.stringify([
      { title: "Business model", text: "Digital-first consumer finance: lending (personal, student, home), a growing financial-services segment (SoFi Money, Invest, credit card), and the Galileo/Technisys technology platform that powers other fintechs. Holds a national bank charter, so it funds loans with lower-cost deposits." },
      { title: "Moat and competition", text: "The bank charter plus a single-app product bundle creates cross-sell and a deposit-funding cost advantage vs non-bank fintechs. Competes with incumbent banks, Chime, Cash App, and brokerage apps; the edge is breadth, not any one product." },
      { title: "Asymmetry check", text: "Bull case rests on fee-based, capital-light revenue (tech platform + financial services) growing faster than balance-sheet lending. Whether that mix shift is real — and how credit performs through a cycle — would need current data to judge." },
    ]),
    skepticReport: JSON.stringify([
      { title: "Credit / balance-sheet risk", text: "A lender carries credit risk: charge-off trends, reserve adequacy, and how personal-loan cohorts perform in a downturn are the key unknowns and need the latest filings." },
      { title: "Profitability quality", text: "Watch GAAP vs adjusted profitability and the role of fair-value marks on the loan book; headline growth can outrun durable earnings." },
      { title: "Hype detector", text: "Heavily discussed on fintwit. Separate deposit/member-growth narrative from booked, recurring, fee-based revenue." },
    ]),
    portfolioFit: JSON.stringify({
      band: "Core-adjacent / satellite",
      diversification: "Adds consumer-fintech exposure distinct from pure software or hardware holdings.",
      learning: "Mix shift toward capital-light fee revenue is the thesis. Confirm it with segment data before sizing."
    }),
    scoreBreakdown: JSON.stringify([
      { label: "Catalyst strength", value: 0 },
      { label: "Evidence quality", value: 0 },
      { label: "Balance-sheet safety", value: 0 },
      { label: "Hype discount", value: 0 },
    ]),
    catalystStrength: "Needs live data",
    hypeRisk: "Elevated",
    recommendedAction: "Watch only",
    sectorBotKey: "saas",
    updatedAt: now,
  },
];

export const seedCatalysts = [
  { ticker: "RKLB", month: "May", title: "Earnings call", detail: "Check revenue quality and Neutron guidance tone." },
  { ticker: "RKLB", month: "Jun", title: "Neutron milestone", detail: "Validate whether the catalyst is funded or just narrative." },
  { ticker: "RKLB", month: "Aug", title: "Launch cadence update", detail: "Compare peers for momentum confirmation." },
  { ticker: "RKLB", month: "Sep", title: "Cash runway checkpoint", detail: "Dilution risk rises if burn remains high." },
  { ticker: "PLTR", month: "May", title: "Earnings call", detail: "Track commercial customer count and net dollar retention." },
  { ticker: "PLTR", month: "Jul", title: "AIPCon event", detail: "Look for booked deals, not just demos." },
  { ticker: "HIMS", month: "May", title: "Earnings call", detail: "Watch subscriber adds and gross margin trend." },
  { ticker: "HIMS", month: "Aug", title: "Category expansion", detail: "Assess CAC payback on new verticals." },
  { ticker: "IONQ", month: "Jun", title: "Bookings update", detail: "Confirm whether bookings convert to recognised revenue." },
  { ticker: "IONQ", month: "Nov", title: "Hardware roadmap", detail: "Separate roadmap targets from demonstrated results." },
  { ticker: "SOFI", month: "Next print", title: "Earnings call", detail: "Watch fee-based revenue mix, deposit growth, and personal-loan charge-off trend." },
  { ticker: "SOFI", month: "Quarterly", title: "Credit / reserve update", detail: "Check reserve build vs charge-offs and any fair-value marks on the loan book." },
];

export const seedMethods = [
  {
    key: "compact",
    name: "Compact Stack",
    tagline: "3-step relative-value read. Fast conviction on mispriced winners.",
    intensity: "Balanced",
    steps: JSON.stringify([
      {
        id: "deep-dive",
        step: 1,
        title: "Deep Dive",
        subtitle: "4-part company breakdown",
        prompt:
          "Generate a comprehensive deep research report on [TICKER]. Cover these 4 areas: 1. Business Model: how do they actually make money? Core product in plain English. 2. Moat & Competition: top 3 competitors. Does [TICKER] have a unique technological advantage or patent that competitors lack? 3. Catalysts: upcoming product launches, regulatory approvals, or partnerships in the next 12 months. 4. Asymmetry check: low valuation floor vs high growth ceiling \u2014 why or why not?",
        note: "Anchor prompt. Run it first \u2014 it feeds every other step.",
      },
      {
        id: "peer",
        step: 2,
        title: "Peer Comparison",
        subtitle: "Does the valuation actually make sense?",
        prompt:
          "Build a relative valuation table for [TICKER] vs [COMPETITOR 1] and [COMPETITOR 2]. Include P/S (TTM and forward), EV/EBITDA, gross margin, YoY revenue growth, and a Value/Growth Score (P/S TTM \u00f7 revenue growth %). Lower score = more growth per dollar of valuation.",
        note: "Cheap only matters relative to growth. This is how you catch mispriced winners.",
      },
      {
        id: "bear",
        step: 3,
        title: "Short Report",
        subtitle: "Skeptic risk assessment",
        prompt:
          "Give a 3-point risk assessment for [TICKER] focused on: accounting irregularities, customer concentration, and competitive threats. Rank by severity and include bearish sources where available.",
        note: "If you can't find real reasons to be skeptical, you haven't finished the work.",
      },
    ]),
  },
  {
    key: "alpha",
    name: "Alpha Pipeline",
    tagline: "Merged 3-step pipeline: deep dive → peer valuation → forensic bear case → verdict.",
    intensity: "Merged",
    steps: JSON.stringify([
      {
        id: "deep-dive",
        step: 1,
        title: "Deep Dive",
        subtitle: "4-part company breakdown",
        prompt:
          "Generate a comprehensive deep research report on [TICKER]. Cover these 4 areas: 1. Business Model: how exactly do they make money? Core product in plain English. 2. Moat: does [TICKER] have a durable edge \u2014 patent, switching cost, network effect, or cost structure that rivals can't copy? 3. Catalysts: upcoming launches, earnings, regulatory events, or partnerships in the next 12 months. 4. Asymmetry: low valuation floor vs high growth ceiling? Why or why not?",
        note: "Anchor prompt. Run it first. Feeds every other prompt in the stack.",
      },
      {
        id: "peer",
        step: 2,
        title: "Peer Comparison",
        subtitle: "Does the valuation actually make sense?",
        prompt:
          "Search Yahoo Finance and Macrotrends. Build a relative valuation table for [TICKER] vs [PEER 1] and [PEER 2]. Include: P/S (TTM and forward), P/FCF, EV/EBITDA, gross margin, YoY revenue growth, and a Value/Growth Score (P/S TTM \u00f7 revenue growth %). Lowest score = most growth per dollar of valuation.",
        note: "Cheap only matters relative to growth. This is how you catch mispriced winners.",
      },
      {
        id: "bear",
        step: 3,
        title: "Bear Case",
        subtitle: "3 biggest reasons NOT to own this",
        prompt:
          "Act as a skeptical short-seller researching [TICKER]. Search SEC filings, earnings transcripts, and recent news. Give the 3 most serious red flags, ranked by severity. Check for: customer concentration (any single customer over 25% of revenue \u2014 latest 10-K), margin compression (gross AND operating, last 4 quarters), unscheduled insider selling (Form 4, not pre-planned 10b5-1), widening GAAP vs non-GAAP gap, and guidance cuts in the last 12 months. Cite sources for each.",
        note: "If you can't find 3 real reasons to be bearish, you haven't done the research.",
      },
    ]),
  },
];

export const seedPeerComparisons = [
  {
    ticker: "RKLB",
    defaultCompetitors: JSON.stringify(["LMT", "BA"]),
    rows: JSON.stringify([
      { ticker: "RKLB", isSubject: true, psTtm: 22.4, psFwd: 13.1, pFcf: null, evEbitda: 0, grossMargin: 26.5, revGrowth: 78, valueGrowthScore: 0.29 },
      { ticker: "LMT", isSubject: false, psTtm: 1.7, psFwd: 1.6, pFcf: 21.4, evEbitda: 13.2, grossMargin: 12.4, revGrowth: 5, valueGrowthScore: 0.34 },
      { ticker: "BA", isSubject: false, psTtm: 1.5, psFwd: 1.3, pFcf: null, evEbitda: 0, grossMargin: 9.8, revGrowth: 7, valueGrowthScore: 0.21 },
    ]),
  },
  {
    ticker: "PLTR",
    defaultCompetitors: JSON.stringify(["SNOW", "DDOG"]),
    rows: JSON.stringify([
      { ticker: "PLTR", isSubject: true, psTtm: 58.2, psFwd: 42.0, pFcf: 110.5, evEbitda: 180.0, grossMargin: 80.2, revGrowth: 30, valueGrowthScore: 1.94 },
      { ticker: "SNOW", isSubject: false, psTtm: 14.1, psFwd: 11.8, pFcf: 62.3, evEbitda: 0, grossMargin: 67.8, revGrowth: 28, valueGrowthScore: 0.50 },
      { ticker: "DDOG", isSubject: false, psTtm: 18.9, psFwd: 15.2, pFcf: 55.7, evEbitda: 95.4, grossMargin: 81.1, revGrowth: 26, valueGrowthScore: 0.73 },
    ]),
  },
  {
    ticker: "HIMS",
    defaultCompetitors: JSON.stringify(["TDOC", "WW"]),
    rows: JSON.stringify([
      { ticker: "HIMS", isSubject: true, psTtm: 4.2, psFwd: 3.1, pFcf: 38.5, evEbitda: 42.0, grossMargin: 80.5, revGrowth: 46, valueGrowthScore: 0.09 },
      { ticker: "TDOC", isSubject: false, psTtm: 0.7, psFwd: 0.7, pFcf: 9.1, evEbitda: 6.8, grossMargin: 70.2, revGrowth: 1, valueGrowthScore: 0.70 },
      { ticker: "WW", isSubject: false, psTtm: 0.4, psFwd: 0.4, pFcf: null, evEbitda: 5.2, grossMargin: 66.4, revGrowth: -10, valueGrowthScore: -0.04 },
    ]),
  },
  {
    ticker: "IONQ",
    defaultCompetitors: JSON.stringify(["RGTI", "IBM"]),
    rows: JSON.stringify([
      { ticker: "IONQ", isSubject: true, psTtm: 145.0, psFwd: 78.0, pFcf: null, evEbitda: 0, grossMargin: 58.0, revGrowth: 95, valueGrowthScore: 1.53 },
      { ticker: "RGTI", isSubject: false, psTtm: 120.0, psFwd: 64.0, pFcf: null, evEbitda: 0, grossMargin: 42.0, revGrowth: 30, valueGrowthScore: 4.00 },
      { ticker: "IBM", isSubject: false, psTtm: 3.6, psFwd: 3.4, pFcf: 18.2, evEbitda: 16.1, grossMargin: 56.7, revGrowth: 2, valueGrowthScore: 1.80 },
    ]),
  },
  {
    ticker: "SOFI",
    defaultCompetitors: JSON.stringify(["HOOD", "AFRM"]),
    rows: JSON.stringify([
      { ticker: "SOFI", isSubject: true, psTtm: 0, psFwd: 0, pFcf: null, evEbitda: 0, grossMargin: 0, revGrowth: 0, valueGrowthScore: 0 },
      { ticker: "HOOD", isSubject: false, psTtm: 0, psFwd: 0, pFcf: null, evEbitda: 0, grossMargin: 0, revGrowth: 0, valueGrowthScore: 0 },
      { ticker: "AFRM", isSubject: false, psTtm: 0, psFwd: 0, pFcf: null, evEbitda: 0, grossMargin: 0, revGrowth: 0, valueGrowthScore: 0 },
    ]),
  },
];

export const seedSectorBots = [
  {
    key: "biotech",
    name: "Biotech",
    focus: "FDA dates, trial phase, cash runway, dilution",
    checklist: JSON.stringify([
      "Where is each asset in the trial pipeline?",
      "When are the next FDA / regulatory dates?",
      "How many quarters of cash runway remain?",
      "What is the recent share-count growth?",
    ]),
  },
  {
    key: "saas",
    name: "SaaS / AI",
    focus: "ARR quality, churn, real customer proof, hype risk",
    checklist: JSON.stringify([
      "Is ARR growth backed by net revenue retention?",
      "What is the gross and logo churn?",
      "Are there named, booked customers vs pilots?",
      "How much of the story is buzzword vs revenue?",
    ]),
  },
  {
    key: "mining",
    name: "Mining",
    focus: "Resource quality, jurisdiction, funding gap, permits",
    checklist: JSON.stringify([
      "What is the grade and size of the resource?",
      "Is the jurisdiction stable and permit-friendly?",
      "What is the gap between funding and build cost?",
      "Are key permits secured?",
    ]),
  },
  {
    key: "defence",
    name: "Defence",
    focus: "Backlog, contract awards, budget exposure, geopolitics",
    checklist: JSON.stringify([
      "How large and funded is the backlog?",
      "What recent contract awards confirm demand?",
      "How exposed is revenue to a single budget?",
      "What geopolitical tailwinds or risks apply?",
    ]),
  },
  {
    key: "semis",
    name: "Semis / Deep tech",
    focus: "Cycle risk, customer concentration, capex sensitivity",
    checklist: JSON.stringify([
      "Where are we in the demand cycle?",
      "How concentrated is the customer base?",
      "How sensitive is the model to capex swings?",
      "Is the technology lead durable?",
    ]),
  },
];
