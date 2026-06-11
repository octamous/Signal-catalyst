import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Keep the default users table so existing storage/template contracts hold.
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

/**
 * Companies — the resolver / discovery universe.
 * SQLite has no array columns, so list-like fields are stored as JSON text.
 */
export const companies = sqliteTable("companies", {
  ticker: text("ticker").primaryKey(),
  name: text("name").notNull(),
  exchange: text("exchange").notNull(),
  country: text("country").notNull(),
  currency: text("currency").notNull(),
  sector: text("sector").notNull(),
  marketCap: text("market_cap").notNull(),
  matchReason: text("match_reason").notNull(),
  riskLevel: text("risk_level").notNull(), // Low | Medium | High | Very high
  score: integer("score").notNull(),
  theme: text("theme"), // discovery "why now" theme label
  whyNow: text("why_now"), // discovery rationale
  isCandidate: integer("is_candidate", { mode: "boolean" }).notNull().default(false),
});

export const insertCompanySchema = createInsertSchema(companies);
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

/**
 * Reports — the deep-dive research package for a company.
 * deepDive / skepticReport / catalysts / scoreBreakdown are JSON text blobs.
 */
export const reports = sqliteTable("reports", {
  ticker: text("ticker").primaryKey(),
  deepDive: text("deep_dive").notNull(), // JSON: { title, text }[]
  skepticReport: text("skeptic_report").notNull(), // JSON: { title, text }[]
  portfolioFit: text("portfolio_fit").notNull(), // JSON: { band, diversification, learning }
  scoreBreakdown: text("score_breakdown").notNull(), // JSON: { label, value }[]
  catalystStrength: text("catalyst_strength").notNull(),
  hypeRisk: text("hype_risk").notNull(),
  recommendedAction: text("recommended_action").notNull(),
  sectorBotKey: text("sector_bot_key"), // FK-ish reference into sectorBots.key
  updatedAt: integer("updated_at").notNull(), // unix ms — drives "last updated"
});

export const insertReportSchema = createInsertSchema(reports);
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

/**
 * Catalysts — upcoming events tied to a company.
 */
export const catalysts = sqliteTable("catalysts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  month: text("month").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
});

export const insertCatalystSchema = createInsertSchema(catalysts).omit({ id: true });
export type InsertCatalyst = z.infer<typeof insertCatalystSchema>;
export type Catalyst = typeof catalysts.$inferSelect;

/**
 * Sector bots — sector-specific scoring checklists.
 */
export const sectorBots = sqliteTable("sector_bots", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  focus: text("focus").notNull(),
  checklist: text("checklist").notNull(), // JSON: string[]
});

export const insertSectorBotSchema = createInsertSchema(sectorBots);
export type InsertSectorBot = z.infer<typeof insertSectorBotSchema>;
export type SectorBot = typeof sectorBots.$inferSelect;

/**
 * Watchlist items — a saved ticker the user is tracking.
 */
export const watchlistItems = sqliteTable("watchlist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull().unique(),
  addedAt: integer("added_at").notNull(), // unix ms
});

export const insertWatchlistItemSchema = createInsertSchema(watchlistItems).omit({
  id: true,
  addedAt: true,
});
export type InsertWatchlistItem = z.infer<typeof insertWatchlistItemSchema>;
export type WatchlistItem = typeof watchlistItems.$inferSelect;

/**
 * Analysis methods — the two overlapping research stacks (compact / alpha).
 * `steps` is a JSON array describing each of the three steps and its prompt.
 */
export const analysisMethods = sqliteTable("analysis_methods", {
  key: text("key").primaryKey(), // 'compact' | 'alpha'
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  intensity: text("intensity").notNull(), // 'Balanced' | 'Aggressive'
  steps: text("steps").notNull(), // JSON: MethodStep[]
});

export const insertAnalysisMethodSchema = createInsertSchema(analysisMethods);
export type InsertAnalysisMethod = z.infer<typeof insertAnalysisMethodSchema>;
export type AnalysisMethodRow = typeof analysisMethods.$inferSelect;

/**
 * Peer comparison rows — seeded relative-valuation table data per ticker.
 * Stored as JSON blob of PeerRow[] keyed by the subject ticker.
 */
export const peerComparisons = sqliteTable("peer_comparisons", {
  ticker: text("ticker").primaryKey(),
  rows: text("rows").notNull(), // JSON: PeerRow[]
  defaultCompetitors: text("default_competitors").notNull(), // JSON: string[]
});

export const insertPeerComparisonSchema = createInsertSchema(peerComparisons);
export type InsertPeerComparison = z.infer<typeof insertPeerComparisonSchema>;
export type PeerComparisonRow = typeof peerComparisons.$inferSelect;

// ---------------------------------------------------------------------------
// API response shapes (parsed/enriched views the frontend consumes).
// ---------------------------------------------------------------------------

export type InsightCard = { title: string; text: string };
export type ScoreFactor = { label: string; value: number };
export type PortfolioFit = { band: string; diversification: string; learning: string };

export type CompanyReport = {
  ticker: string;
  name: string;
  sector: string;
  score: number;
  riskLevel: string;
  catalystStrength: string;
  hypeRisk: string;
  recommendedAction: string;
  deepDive: InsightCard[];
  skepticReport: InsightCard[];
  portfolioFit: PortfolioFit;
  scoreBreakdown: ScoreFactor[];
  catalysts: Catalyst[];
  sectorBot: SectorBot | null;
  updatedAt: number;
};

export type WatchlistEntry = WatchlistItem & {
  company: Company | null;
};

// ---------------------------------------------------------------------------
// Analysis method + generated-analysis shapes.
// ---------------------------------------------------------------------------

export type MethodStep = {
  id: string; // 'deep-dive' | 'peer' | 'bear'
  step: number;
  title: string;
  subtitle: string;
  prompt: string; // the encoded analyst prompt for this step
  note: string;
};

export type AnalysisMethod = {
  key: "compact" | "alpha";
  name: string;
  tagline: string;
  intensity: string;
  steps: MethodStep[];
};

export type PeerRow = {
  ticker: string;
  isSubject: boolean;
  psTtm: number;
  psFwd: number;
  pFcf: number | null; // null when not applicable / unavailable
  evEbitda: number;
  grossMargin: number; // %
  revGrowth: number; // YoY %
  valueGrowthScore: number; // P/S TTM ÷ revenue growth %
};

export type BearFlag = {
  rank: number;
  severity: "Severe" | "High" | "Moderate";
  title: string;
  detail: string; // evidence / detail
  source: string;
  whatWouldDisprove: string;
};

export type ResearchRating = "BUY_CANDIDATE" | "WATCHLIST" | "AVOID" | "NO_EDGE";

// ----- High-level structured sections for the 3-step alpha method -----

export type DeepDiveSection = {
  summary: string;
  businessModel: string[];
  moatCompetition: string[];
  catalysts: string[];
  asymmetry: string[];
};

export type PeerValuationSection = {
  summary: string;
  columns: string[];
  rows: PeerRow[];
  note: string;
};

export type BearCaseSection = {
  summary: string;
  redFlags: BearFlag[]; // ranked; BearFlag carries whatWouldDisprove
};

export type GeneralVerdictSection = {
  rating: ResearchRating;
  confidence: "Low" | "Medium" | "High";
  why: string;
  keyConditions: string[];
  notFinancialAdvice: true;
};

// Section B — what the live data / news likely does to the stock.
export type MarketViewSection = {
  lean: "Bullish" | "Bearish" | "Mixed"; // overall read of the live data/news
  summary: string; // likely market reaction and why
  drivers: string[]; // the specific data points / headlines driving the read
};

// The structured payload the generate-analysis endpoint returns (live or mock).
export type GeneratedAnalysis = {
  ticker: string;
  method: "compact" | "alpha";
  methodName: string;
  generatedBy: "claude" | "mock";
  model?: string;
  generatedAt: number;
  debug?: string; // internal error summary when the live call fails
  // Live-market snapshot used for this analysis (null when no Finnhub layer ran).
  live: LiveMarketData | null;
  marketView: MarketViewSection;
  deepDive: DeepDiveSection;
  peerValuation: PeerValuationSection;
  bearCase: BearCaseSection;
  generalVerdict: GeneralVerdictSection;
};

// ----- Market impact (ForexFactory-style, multi-asset) -----

export type AssetClass = "fx" | "crypto" | "stocks";
export type ImpactLevel = "High" | "Medium" | "Low";
export type DirectionBias = "Bullish" | "Bearish" | "Volatile" | "Two-way";

export type MarketImpactEvent = {
  id: string;
  dateTime: string; // ISO-ish display string, e.g. "2025-06-12 13:30 UTC"
  whenLabel: string; // plain relative label, e.g. "in 2 days"
  assetClass: AssetClass;
  eventName: string;
  impactLevel: ImpactLevel;
  affectedSymbols: string[]; // e.g. ["EUR/USD", "DXY"]
  marketBias: DirectionBias; // overall lean: Bullish | Bearish | Volatile | Two-way
  expectedDirectionBias: DirectionBias; // legacy alias of marketBias (kept for compatibility)
  bullCase: string; // concrete up-scenario
  bearCase: string; // concrete down-scenario
  volatilityRisk: "High" | "Medium" | "Low"; // how violent the move could be
  whyItMatters: string;
  whatToWatch: string;
  sourceLabel: string;
};

// ----- Live market data (Finnhub) -----

// Status of the live-data layer for a given request.
//   live           — Finnhub key present and at least one call succeeded.
//   unavailable    — Finnhub key present but every call failed/rate-limited.
//   no_key         — FINNHUB_API_KEY is not configured (pure fallback mode).
export type LiveDataStatus = "live" | "unavailable" | "no_key";

export type LiveQuote = {
  current: number;
  change: number; // absolute change vs previous close
  percentChange: number; // % change vs previous close
  high: number;
  low: number;
  open: number;
  previousClose: number;
};

export type LiveProfile = {
  name: string;
  ticker: string;
  exchange: string;
  country: string;
  currency: string;
  industry: string; // finnhubIndustry
  marketCapitalization: number; // in millions, Finnhub's unit
  shareOutstanding: number;
  ipo: string;
  weburl: string;
  logo: string;
};

// Subset of Finnhub's /stock/metric "all" payload that we surface.
export type LiveMetrics = {
  peTtm: number | null;
  psTtm: number | null;
  evToEbitdaTtm: number | null;
  grossMarginTtm: number | null; // %
  netMarginTtm: number | null; // %
  revenueGrowthTtmYoy: number | null; // %
  high52Week: number | null;
  low52Week: number | null;
  beta: number | null;
};

export type LiveNewsItem = {
  id: number;
  datetime: number; // unix seconds
  headline: string;
  summary: string;
  source: string;
  url: string;
  category: string;
  related: string; // comma-joined symbols
};

// Normalized live-market context returned by the Finnhub service. Every field
// is optional so a partial fetch (e.g. quote ok, metrics rate-limited) still
// yields a usable object. `errors` records which sub-calls failed.
export type LiveMarketData = {
  dataStatus: LiveDataStatus;
  provider: "finnhub";
  resolvedSymbol: string | null;
  quote: LiveQuote | null;
  profile: LiveProfile | null;
  metrics: LiveMetrics | null;
  companyNews: LiveNewsItem[];
  marketNews: LiveNewsItem[];
  fetchedAt: number;
  errors: string[];
};

// A live market-news headline classified for the Market Impact page.
export type LiveMarketNewsItem = {
  id: number;
  datetime: number; // unix seconds
  headline: string;
  summary: string;
  source: string;
  url: string;
  bias: "Bullish" | "Bearish" | "Mixed" | "Volatility"; // heuristic classification
  affected: string[]; // symbols / sectors mentioned (best-effort)
};

// ----- AI research chat (built-in finance research assistant) -----

export type AiChatContext = {
  selectedTicker?: string;
  method?: "compact" | "alpha";
};

export type AiChatRequest = {
  message: string;
  context?: AiChatContext;
};

// One assistant reply. `generatedBy` flags whether it came from the live
// Claude call or the deterministic offline fallback.
export type AiChatResponse = {
  reply: string;
  generatedBy: "claude" | "mock";
  model?: string;
  // True when Finnhub live context (quote/news) was attached to the prompt.
  liveData: boolean;
  liveStatus?: LiveDataStatus;
  disclaimer: string;
  generatedAt: number;
  debug?: string; // internal error summary when the live call falls back
};
