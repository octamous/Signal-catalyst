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

  // Methods + peer comparisons seed independently (idempotent upsert) so the
  // alpha-pivot data lands even on databases created before this migration.
  const methodCount = sqlite.prepare("SELECT COUNT(*) AS n FROM analysis_methods").get() as { n: number };
  if (methodCount.n === 0) {
    const insertMethod = sqlite.prepare(
      `INSERT INTO analysis_methods (key, name, tagline, intensity, steps)
       VALUES (@key, @name, @tagline, @intensity, @steps)`,
    );
    const insertPeer = sqlite.prepare(
      `INSERT INTO peer_comparisons (ticker, rows, default_competitors)
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
    const term = `%${q.trim()}%`;
    const rows = db
      .select()
      .from(companies)
      .where(or(like(companies.ticker, term), like(companies.name, term)))
      .all();
    // Rank exact ticker/name matches first, then by score.
    const ql = q.trim().toLowerCase();
    return rows.sort((a, b) => {
      const aExact = a.ticker.toLowerCase() === ql || a.name.toLowerCase() === ql ? 1 : 0;
      const bExact = b.ticker.toLowerCase() === ql || b.name.toLowerCase() === ql ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return b.score - a.score;
    });
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
