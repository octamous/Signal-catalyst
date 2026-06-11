import {
  users,
  companies,
  reports,
  catalysts,
  sectorBots,
  watchlistItems,
  analysisMethods,
  peerComparisons,
} from "@shared/schema";
import type {
  User,
  InsertUser,
  Company,
  Report,
  Catalyst,
  SectorBot,
  WatchlistItem,
  CompanyReport,
  WatchlistEntry,
  InsightCard,
  ScoreFactor,
  PortfolioFit,
  AnalysisMethod,
  MethodStep,
  PeerRow,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, like, or } from "drizzle-orm";
import {
  seedCompanies,
  seedReports,
  seedCatalysts,
  seedSectorBots,
  seedMethods,
  seedPeerComparisons,
} from "./seed";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Common English words that look like tickers but almost never are; excluded so
// "SOFI tech" doesn't try to resolve "TECH" as a symbol when SOFI is present.
const TICKER_STOPWORDS = new Set([
  "THE", "AND", "FOR", "ARE", "WITH", "THIS", "THAT", "STOCK", "SHARE", "SHARES",
  "ANALYSE", "ANALYZE", "ANALYSIS", "BUY", "SELL", "HOLD", "VS", "VERSUS",
  "TECH", "AI", "INC", "CORP", "LTD", "PLC", "CO", "GROUP", "GROWTH",
]);

/**
 * Extract candidate ticker tokens from a free-text query. A ticker token is an
 * uppercase-able alphanumeric run of 1–6 chars (optionally with a dot, e.g.
 * BRK.B). We dedupe and drop obvious stopwords. Order is preserved.
 */
export function tokenizeTickers(q: string): string[] {
  const tokens = q.match(/[A-Za-z][A-Za-z0-9.]{0,5}/g) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const up = t.toUpperCase();
    if (up.length < 2) continue; // skip single letters to avoid noise
    if (TICKER_STOPWORDS.has(up)) continue;
    if (seen.has(up)) continue;
    seen.add(up);
    out.push(up);
  }
  return out;
}

/** Reduce arbitrary text to a schema-safe symbol (letters/digits/dot, max 12). */
export function sanitizeTicker(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 12);
  return cleaned || null;
}

// ---------------------------------------------------------------------------
// Schema bootstrap. The template ships without migrations in dev, so we create
// tables defensively (idempotent) and seed mock data on first run.
// ---------------------------------------------------------------------------
function bootstrap() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companies (
      ticker TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      exchange TEXT NOT NULL,
      country TEXT NOT NULL,
      currency TEXT NOT NULL,
      sector TEXT NOT NULL,
      market_cap TEXT NOT NULL,
      match_reason TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      score INTEGER NOT NULL,
      theme TEXT,
      why_now TEXT,
      is_candidate INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS reports (
      ticker TEXT PRIMARY KEY,
      deep_dive TEXT NOT NULL,
      skeptic_report TEXT NOT NULL,
      portfolio_fit TEXT NOT NULL,
      score_breakdown TEXT NOT NULL,
      catalyst_strength TEXT NOT NULL,
      hype_risk TEXT NOT NULL,
      recommended_action TEXT NOT NULL,
      sector_bot_key TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS catalysts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      month TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sector_bots (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      focus TEXT NOT NULL,
      checklist TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS watchlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL UNIQUE,
      added_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analysis_methods (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      intensity TEXT NOT NULL,
      steps TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS peer_comparisons (
      ticker TEXT PRIMARY KEY,
      rows TEXT NOT NULL,
      default_competitors TEXT NOT NULL
    );
  `);

  const existing = sqlite.prepare("SELECT COUNT(*) AS n FROM companies").get() as { n: number };
  if (existing.n === 0) {
    const insertCompany = sqlite.prepare(
      `INSERT INTO companies (ticker, name, exchange, country, currency, sector, market_cap, match_reason, risk_level, score, theme, why_now, is_candidate)
       VALUES (@ticker, @name, @exchange, @country, @currency, @sector, @marketCap, @matchReason, @riskLevel, @score, @theme, @whyNow, @isCandidate)`,
    );
    const insertReport = sqlite.prepare(
      `INSERT INTO reports (ticker, deep_dive, skeptic_report, portfolio_fit, score_breakdown, catalyst_strength, hype_risk, recommended_action, sector_bot_key, updated_at)
       VALUES (@ticker, @deepDive, @skepticReport, @portfolioFit, @scoreBreakdown, @catalystStrength, @hypeRisk, @recommendedAction, @sectorBotKey, @updatedAt)`,
    );
    const insertCatalyst = sqlite.prepare(
      `INSERT INTO catalysts (ticker, month, title, detail) VALUES (@ticker, @month, @title, @detail)`,
    );
    const insertSectorBot = sqlite.prepare(
      `INSERT INTO sector_bots (key, name, focus, checklist) VALUES (@key, @name, @focus, @checklist)`,
    );

    const tx = sqlite.transaction(() => {
      for (const c of seedCompanies) {
        insertCompany.run({ ...c, isCandidate: c.isCandidate ? 1 : 0 });
      }
      for (const r of seedReports) insertReport.run(r);
      for (const cat of seedCatalysts) insertCatalyst.run(cat);
      for (const b of seedSectorBots) insertSectorBot.run(b);
    });
    tx();
  }

  // Universe backfill: insert any seed companies/reports/catalysts/peers that
  // are missing, so a database created before the universe expansion still gets
  // SOFI and the broader ticker list without a full reseed. INSERT OR IGNORE
  // never clobbers a curated row that already exists.
  {
    const insertCompany = sqlite.prepare(
      `INSERT OR IGNORE INTO companies (ticker, name, exchange, country, currency, sector, market_cap, match_reason, risk_level, score, theme, why_now, is_candidate)
       VALUES (@ticker, @name, @exchange, @country, @currency, @sector, @marketCap, @matchReason, @riskLevel, @score, @theme, @whyNow, @isCandidate)`,
    );
    const insertReport = sqlite.prepare(
      `INSERT OR IGNORE INTO reports (ticker, deep_dive, skeptic_report, portfolio_fit, score_breakdown, catalyst_strength, hype_risk, recommended_action, sector_bot_key, updated_at)
       VALUES (@ticker, @deepDive, @skepticReport, @portfolioFit, @scoreBreakdown, @catalystStrength, @hypeRisk, @recommendedAction, @sectorBotKey, @updatedAt)`,
    );
    const existingCatalyst = sqlite.prepare(
      "SELECT COUNT(*) AS n FROM catalysts WHERE ticker = @ticker AND title = @title",
    );
    const insertCatalyst = sqlite.prepare(
      `INSERT INTO catalysts (ticker, month, title, detail) VALUES (@ticker, @month, @title, @detail)`,
    );
    const tx = sqlite.transaction(() => {
      for (const c of seedCompanies) {
        insertCompany.run({ ...c, theme: c.theme ?? null, whyNow: c.whyNow ?? null, isCandidate: c.isCandidate ? 1 : 0 });
      }
      for (const r of seedReports) insertReport.run(r);
      for (const cat of seedCatalysts) {
        const seen = existingCatalyst.get({ ticker: cat.ticker, title: cat.title }) as { n: number };
        if (seen.n === 0) insertCatalyst.run(cat);
      }
    });
    tx();
  }

  // Methods + peer comparisons seed independently (idempotent upsert) so the
  // alpha-pivot data lands even on databases created before this migration.
  // INSERT OR IGNORE backfills any newly added peer set (e.g. SOFI) without
  // clobbering existing rows.
  {
    const insertMethod = sqlite.prepare(
      `INSERT OR IGNORE INTO analysis_methods (key, name, tagline, intensity, steps)
       VALUES (@key, @name, @tagline, @intensity, @steps)`,
    );
    const insertPeer = sqlite.prepare(
      `INSERT OR IGNORE INTO peer_comparisons (ticker, rows, default_competitors)
       VALUES (@ticker, @rows, @defaultCompetitors)`,
    );
    const tx = sqlite.transaction(() => {
      for (const m of seedMethods) insertMethod.run(m);
      for (const p of seedPeerComparisons) insertPeer.run(p);
    });
    tx();
  }
}

bootstrap();

export interface IStorage {
  // template baseline
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // domain
  searchCompanies(q: string): Promise<Company[]>;
  resolveCompany(input: string): Promise<Company>;
  getCompany(ticker: string): Promise<Company | undefined>;
  getDiscoveryCandidates(): Promise<Company[]>;
  getReport(ticker: string): Promise<CompanyReport | undefined>;
  getMethods(): Promise<AnalysisMethod[]>;
  getMethod(key: string): Promise<AnalysisMethod | undefined>;
  getPeerComparison(ticker: string): Promise<{ rows: PeerRow[]; defaultCompetitors: string[] } | undefined>;
  getWatchlist(): Promise<WatchlistEntry[]>;
  addToWatchlist(ticker: string): Promise<WatchlistEntry>;
  removeFromWatchlist(ticker: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.username, username)).get();
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return db.insert(users).values(insertUser).returning().get();
  }

  async searchCompanies(q: string): Promise<Company[]> {
    const raw = q.trim();
    if (!raw) return [];
    const term = `%${raw}%`;
    const found = new Map<string, Company>();

    // 1. Direct substring match on ticker or name (the original behaviour).
    for (const row of db
      .select()
      .from(companies)
      .where(or(like(companies.ticker, term), like(companies.name, term)))
      .all()) {
      found.set(row.ticker, row);
    }

    // 2. Ticker-token matching: split the query into upper-case alphanumeric
    //    tokens (e.g. "SOFI tech" → ["SOFI","TECH"]) and look each up as an
    //    exact ticker. This means natural-language queries that *contain* a
    //    ticker still surface that company even if the whole string doesn't
    //    substring-match a row.
    for (const token of tokenizeTickers(raw)) {
      if (found.has(token)) continue;
      const exact = db.select().from(companies).where(eq(companies.ticker, token)).get();
      if (exact) found.set(exact.ticker, exact);
    }

    const ql = raw.toLowerCase();
    const tokenSet = new Set(tokenizeTickers(raw));
    return Array.from(found.values()).sort((a, b) => {
      const aExact =
        a.ticker.toLowerCase() === ql || a.name.toLowerCase() === ql || tokenSet.has(a.ticker) ? 1 : 0;
      const bExact =
        b.ticker.toLowerCase() === ql || b.name.toLowerCase() === ql || tokenSet.has(b.ticker) ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return b.score - a.score;
    });
  }

  /**
   * Resolve a company for analysis. If the ticker/name isn't seeded, return a
   * transient (un-persisted) company object so the analysis pipeline can run on
   * an unknown name instead of dead-ending at a 404. Transient companies carry
   * score 0 and a clear matchReason so the UI / fallback can flag the data gap.
   */
  async resolveCompany(input: string): Promise<Company> {
    const trimmed = input.trim();
    const upper = trimmed.toUpperCase();

    const direct = db.select().from(companies).where(eq(companies.ticker, upper)).get();
    if (direct) return direct;

    // Try ticker tokens inside a longer query string.
    for (const token of tokenizeTickers(trimmed)) {
      const hit = db.select().from(companies).where(eq(companies.ticker, token)).get();
      if (hit) return hit;
    }

    // Try a name substring match (first/best by score).
    const byName = db
      .select()
      .from(companies)
      .where(like(companies.name, `%${trimmed}%`))
      .all()
      .sort((a, b) => b.score - a.score)[0];
    if (byName) return byName;

    // Build a transient company from the raw input. Prefer a clean ticker
    // token as the symbol; otherwise derive a safe symbol from the input.
    const tickerToken = tokenizeTickers(trimmed)[0];
    const ticker = (tickerToken ?? sanitizeTicker(upper) ?? "UNKNOWN").slice(0, 12);
    return {
      ticker,
      name: trimmed || ticker,
      exchange: "Unknown",
      country: "Unknown",
      currency: "USD",
      sector: "Unclassified",
      marketCap: "—",
      matchReason: "Unlisted in seed universe — analysed from query input",
      riskLevel: "Unknown",
      score: 0,
      theme: null,
      whyNow: null,
      isCandidate: false,
    };
  }

  async getCompany(ticker: string): Promise<Company | undefined> {
    return db.select().from(companies).where(eq(companies.ticker, ticker.toUpperCase())).get();
  }

  async getDiscoveryCandidates(): Promise<Company[]> {
    return db
      .select()
      .from(companies)
      .where(eq(companies.isCandidate, true))
      .all()
      .sort((a, b) => b.score - a.score);
  }

  async getReport(ticker: string): Promise<CompanyReport | undefined> {
    const t = ticker.toUpperCase();
    const company = db.select().from(companies).where(eq(companies.ticker, t)).get();
    const report = db.select().from(reports).where(eq(reports.ticker, t)).get();
    if (!company || !report) return undefined;

    const companyCatalysts = db
      .select()
      .from(catalysts)
      .where(eq(catalysts.ticker, t))
      .all();

    let sectorBot: SectorBot | null = null;
    if (report.sectorBotKey) {
      sectorBot =
        db.select().from(sectorBots).where(eq(sectorBots.key, report.sectorBotKey)).get() ?? null;
    }

    return {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      score: company.score,
      riskLevel: company.riskLevel,
      catalystStrength: report.catalystStrength,
      hypeRisk: report.hypeRisk,
      recommendedAction: report.recommendedAction,
      deepDive: JSON.parse(report.deepDive) as InsightCard[],
      skepticReport: JSON.parse(report.skepticReport) as InsightCard[],
      portfolioFit: JSON.parse(report.portfolioFit) as PortfolioFit,
      scoreBreakdown: JSON.parse(report.scoreBreakdown) as ScoreFactor[],
      catalysts: companyCatalysts,
      sectorBot: sectorBot
        ? ({ ...sectorBot, checklist: sectorBot.checklist } as SectorBot)
        : null,
      updatedAt: report.updatedAt,
    };
  }

  async getMethods(): Promise<AnalysisMethod[]> {
    const rows = db.select().from(analysisMethods).all();
    return rows.map((r) => ({
      key: r.key as "compact" | "alpha",
      name: r.name,
      tagline: r.tagline,
      intensity: r.intensity,
      steps: JSON.parse(r.steps) as MethodStep[],
    }));
  }

  async getMethod(key: string): Promise<AnalysisMethod | undefined> {
    const r = db.select().from(analysisMethods).where(eq(analysisMethods.key, key)).get();
    if (!r) return undefined;
    return {
      key: r.key as "compact" | "alpha",
      name: r.name,
      tagline: r.tagline,
      intensity: r.intensity,
      steps: JSON.parse(r.steps) as MethodStep[],
    };
  }

  async getPeerComparison(
    ticker: string,
  ): Promise<{ rows: PeerRow[]; defaultCompetitors: string[] } | undefined> {
    const r = db
      .select()
      .from(peerComparisons)
      .where(eq(peerComparisons.ticker, ticker.toUpperCase()))
      .get();
    if (!r) return undefined;
    return {
      rows: JSON.parse(r.rows) as PeerRow[],
      defaultCompetitors: JSON.parse(r.defaultCompetitors) as string[],
    };
  }

  async getWatchlist(): Promise<WatchlistEntry[]> {
    const items = db.select().from(watchlistItems).all();
    return items
      .map((item: WatchlistItem) => {
        const company =
          db.select().from(companies).where(eq(companies.ticker, item.ticker)).get() ?? null;
        return { ...item, company };
      })
      .sort((a, b) => b.addedAt - a.addedAt);
  }

  async addToWatchlist(ticker: string): Promise<WatchlistEntry> {
    const t = ticker.toUpperCase();
    const existing = db
      .select()
      .from(watchlistItems)
      .where(eq(watchlistItems.ticker, t))
      .get();
    let item: WatchlistItem;
    if (existing) {
      item = existing;
    } else {
      item = db
        .insert(watchlistItems)
        .values({ ticker: t, addedAt: Date.now() })
        .returning()
        .get();
    }
    const company = db.select().from(companies).where(eq(companies.ticker, t)).get() ?? null;
    return { ...item, company };
  }

  async removeFromWatchlist(ticker: string): Promise<boolean> {
    const res = db
      .delete(watchlistItems)
      .where(eq(watchlistItems.ticker, ticker.toUpperCase()))
      .run();
    return res.changes > 0;
  }
}

export const storage = new DatabaseStorage();
