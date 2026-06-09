import type { Express } from "express";
import type { Server } from "node:http";
import { z } from "zod";
import { storage } from "./storage";
import { generateAnalysis } from "./claude";
import { chatWithAnalyst } from "./aiChat";
import { getMarketImpact } from "./marketImpact";

const addWatchlistSchema = z.object({
  ticker: z.string().trim().min(1).max(12),
});

const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  context: z
    .object({
      selectedTicker: z.string().trim().min(1).max(12).optional(),
      method: z.enum(["compact", "alpha"]).optional(),
    })
    .optional(),
});

// The UI no longer exposes a method selector — there is one merged alpha
// pipeline. We still accept an optional `method`/`competitors` body for
// backward compatibility, but always run the merged "alpha" stack.
const generateAnalysisSchema = z.object({
  method: z.enum(["compact", "alpha"]).optional(),
  competitors: z.array(z.string().trim().min(1).max(12)).max(4).optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Company resolver — matches by ticker or company name.
  app.get("/api/companies/search", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    if (!q.trim()) {
      // empty query returns the candidate universe so the UI has content
      const all = await storage.getDiscoveryCandidates();
      return res.json(all);
    }
    const results = await storage.searchCompanies(q);
    res.json(results);
  });

  // Full research report for a ticker.
  app.get("/api/companies/:ticker/report", async (req, res) => {
    const report = await storage.getReport(req.params.ticker);
    if (!report) {
      return res.status(404).json({ message: "No report for that ticker yet." });
    }
    res.json(report);
  });

  // Discovery engine candidates.
  app.get("/api/discovery", async (_req, res) => {
    const candidates = await storage.getDiscoveryCandidates();
    res.json(candidates);
  });

  // Analysis methods (compact / alpha stacks with their three steps).
  app.get("/api/methods", async (_req, res) => {
    const methods = await storage.getMethods();
    res.json(methods);
  });

  // Seeded peer-comparison table for a ticker.
  app.get("/api/companies/:ticker/peers", async (req, res) => {
    const peer = await storage.getPeerComparison(req.params.ticker);
    if (!peer) {
      return res.status(404).json({ message: "No peer set seeded for that ticker yet." });
    }
    res.json(peer);
  });

  // Generate a structured analysis report. Tries the live Claude Messages API
  // (server-side only) and falls back to a polished mock flagged generatedBy:'mock'.
  app.post("/api/companies/:ticker/generate-analysis", async (req, res) => {
    const parsed = generateAnalysisSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid analysis request." });
    }
    const ticker = req.params.ticker.toUpperCase();
    const company = await storage.getCompany(ticker);
    if (!company) {
      return res.status(404).json({ message: "Unknown ticker." });
    }
    // Always run the single merged alpha pipeline regardless of any client input.
    const method = await storage.getMethod("alpha");
    if (!method) {
      return res.status(404).json({ message: "Analysis pipeline unavailable." });
    }
    const peer = await storage.getPeerComparison(ticker);
    const report = await storage.getReport(ticker);
    const competitors =
      parsed.data.competitors && parsed.data.competitors.length
        ? parsed.data.competitors.map((c) => c.toUpperCase())
        : (peer?.defaultCompetitors ?? []);

    const analysis = await generateAnalysis({
      ticker,
      method,
      company,
      report,
      peer,
      competitors,
    });
    res.json(analysis);
  });

  // Built-in AI research chat. Tries the live Claude Messages API (server-side
  // only, same credential resolution as generate-analysis) and falls back to a
  // useful structured response flagged generatedBy:'mock'. Never has live data.
  app.post("/api/ai/chat", async (req, res) => {
    const parsed = aiChatSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: "A non-empty message is required." });
    }
    const { message, context } = parsed.data;

    // Assemble seeded app context for the requested ticker, if any.
    let appContext: string | undefined;
    const ticker = context?.selectedTicker?.toUpperCase();
    if (ticker) {
      const company = await storage.getCompany(ticker);
      const peer = await storage.getPeerComparison(ticker);
      const report = await storage.getReport(ticker);
      const parts: string[] = [];
      if (company) {
        parts.push(
          `${company.ticker} — ${company.name} (${company.sector}, ${company.exchange}). ` +
            `Seeded score ${company.score}/100, risk ${company.riskLevel}.` +
            (company.whyNow ? ` Why now: ${company.whyNow}` : ""),
        );
      }
      if (report?.recommendedAction) {
        parts.push(`Seeded recommended action: ${report.recommendedAction}. Catalyst strength: ${report.catalystStrength}; hype risk: ${report.hypeRisk}.`);
      }
      if (peer?.rows?.length) {
        const subj = peer.rows.find((r) => r.isSubject) ?? peer.rows[0];
        parts.push(
          `Seeded peer/value-growth data: P/S TTM ${subj.psTtm}, fwd ${subj.psFwd}, rev growth ${subj.revGrowth}% YoY, ` +
            `value/growth score ${subj.valueGrowthScore}. Default peers: ${peer.defaultCompetitors.join(", ")}.`,
        );
      }
      appContext = parts.length ? parts.join("\n") : undefined;
    }

    const response = await chatWithAnalyst({ message, context, appContext });
    res.json(response);
  });

  // Market-impact calendar (seeded / mock, multi-asset).
  app.get("/api/market-impact", async (req, res) => {
    const raw = typeof req.query.assetClass === "string" ? req.query.assetClass.toLowerCase() : "all";
    const assetClass = ["fx", "crypto", "stocks", "all"].includes(raw)
      ? (raw as "fx" | "crypto" | "stocks" | "all")
      : "all";
    res.json({
      assetClass,
      live: false,
      events: getMarketImpact(assetClass),
    });
  });

  // Watchlist.
  app.get("/api/watchlist", async (_req, res) => {
    const items = await storage.getWatchlist();
    res.json(items);
  });

  app.post("/api/watchlist", async (req, res) => {
    const parsed = addWatchlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "A valid ticker is required." });
    }
    const company = await storage.getCompany(parsed.data.ticker);
    if (!company) {
      return res.status(404).json({ message: "Unknown ticker." });
    }
    const entry = await storage.addToWatchlist(parsed.data.ticker);
    res.status(201).json(entry);
  });

  app.delete("/api/watchlist/:ticker", async (req, res) => {
    const removed = await storage.removeFromWatchlist(req.params.ticker);
    if (!removed) {
      return res.status(404).json({ message: "Ticker not on watchlist." });
    }
    res.json({ ok: true });
  });

  return httpServer;
}
