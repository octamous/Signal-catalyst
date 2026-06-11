import { useEffect, useRef, useState } from "react";
import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bitcoin,
  CandlestickChart,
  Check,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  DollarSign,
  Eye,
  Factory,
  Flag,
  Gauge,
  HelpCircle,
  Loader2,
  MessageSquare,
  Moon,
  Plus,
  Radar,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Skull,
  Send,
  Sparkles,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import { apiRequest, queryClient } from "./lib/queryClient";
import type {
  AiChatResponse,
  Company,
  DecisionAction,
  DecisionSummary,
  GeneratedAnalysis,
  LiveMarketData,
  LiveMarketNewsItem,
  MarketImpactEvent,
  PeerRow,
  ResearchRating,
  WatchlistEntry,
} from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

function Logo() {
  return (
    <div className="flex items-center gap-3" data-testid="brand-logo">
      <svg
        aria-label="Signal Catalyst logo"
        viewBox="0 0 40 40"
        className="h-10 w-10 text-primary"
        fill="none"
      >
        <rect x="5" y="5" width="30" height="30" rx="8" stroke="currentColor" strokeWidth="2.4" />
        <path d="M11 27l6-12 4 7 3-5 5 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="29" cy="13" r="3" fill="currentColor" />
      </svg>
      <div>
        <div className="text-sm font-black tracking-tight text-sidebar-foreground">Signal Catalyst</div>
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Alpha research</div>
      </div>
    </div>
  );
}

function riskBadgeVariant(risk: string): "destructive" | "outline" {
  return risk === "High" || risk === "Very high" ? "destructive" : "outline";
}

function severityVariant(sev: string): "destructive" | "secondary" | "outline" {
  if (sev === "Severe") return "destructive";
  if (sev === "High") return "secondary";
  return "outline";
}

const RATING_META: Record<
  ResearchRating,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; tone: string }
> = {
  BUY_CANDIDATE: { label: "Buy candidate", variant: "default", tone: "text-primary" },
  WATCHLIST: { label: "Watchlist", variant: "secondary", tone: "text-foreground" },
  AVOID: { label: "Avoid", variant: "destructive", tone: "text-destructive" },
  NO_EDGE: { label: "No edge", variant: "outline", tone: "text-muted-foreground" },
};

function impactBadgeVariant(level: string): "destructive" | "secondary" | "outline" {
  if (level === "High") return "destructive";
  if (level === "Medium") return "secondary";
  return "outline";
}

/* ============================================================
   GLOSSARY — plain-English definitions for finance jargon.
   Each entry: a simple "what it is" + "why it matters" line.
   Keyed by a canonical term; `aliases` catch the variants that
   appear in live/seeded text so we can auto-highlight them.
   ============================================================ */
type GlossaryEntry = { term: string; def: string; why: string; aliases?: string[] };

const GLOSSARY: GlossaryEntry[] = [
  { term: "P/S TTM", def: "Price-to-Sales over the trailing twelve months — the share price compared with the last year of revenue.", why: "A quick read on how expensive a stock is versus the sales it actually brings in. Higher = pricier.", aliases: ["p/s ttm", "ps ttm", "price-to-sales", "price to sales", "p/s"] },
  { term: "P/E", def: "Price-to-Earnings — the share price divided by yearly profit per share.", why: "Shows how many years of current profit you're paying for. High P/E means the market expects fast growth.", aliases: ["p/e", "pe ratio", "price-to-earnings", "price to earnings"] },
  { term: "TTM", def: "Trailing Twelve Months — the most recent 12 months of results.", why: "Uses real, already-reported numbers instead of forecasts.", aliases: ["ttm", "trailing twelve months"] },
  { term: "EPS", def: "Earnings Per Share — company profit divided by the number of shares.", why: "The per-share slice of profit; rising EPS usually supports a higher stock price.", aliases: ["eps", "earnings per share"] },
  { term: "Revenue growth", def: "How fast sales are increasing, usually year over year (YoY).", why: "The engine of most growth stories — fast, durable growth is what justifies a high valuation.", aliases: ["revenue growth", "rev growth", "rev yoy", "yoy growth", "sales growth"] },
  { term: "Net margin", def: "The share of revenue left as profit after ALL costs and taxes.", why: "Shows whether the business actually makes money, not just sales.", aliases: ["net margin", "net profit margin"] },
  { term: "Gross margin", def: "Revenue minus the direct cost of the product, as a % of revenue.", why: "High gross margin means lots of room to fund growth and still profit.", aliases: ["gross margin", "gross %"] },
  { term: "Beta", def: "How much a stock moves relative to the overall market.", why: "Beta above 1 means bigger swings than the market — more risk and more potential reward.", aliases: ["beta"] },
  { term: "Market cap", def: "Market capitalization — the total value of all shares (price × shares).", why: "Tells you the size of the company and roughly how much room it has to grow.", aliases: ["market cap", "market capitalization", "mkt cap"] },
  { term: "Resistance", def: "A price level a stock has struggled to rise above before.", why: "Breaking above resistance can signal momentum; failing there can stall a rally.", aliases: ["resistance"] },
  { term: "Support", def: "A price level where a stock has tended to stop falling.", why: "Holding support suggests buyers step in; losing it can open more downside.", aliases: ["support level"] },
  { term: "52-week high/low", def: "The highest and lowest price over the past year.", why: "A quick gauge of where the stock sits in its recent range.", aliases: ["52-week high", "52-week low", "52w high", "52w low", "52-week"] },
  { term: "Volume", def: "How many shares traded in a period.", why: "High volume confirms conviction behind a move; low volume makes it less reliable.", aliases: ["trading volume"] },
  { term: "Valuation", def: "What the market is paying for the business versus what it earns or owns.", why: "Even a great company can be a bad buy if the valuation is too high.", aliases: ["valuation", "valued at", "re-rate", "re-rated", "multiple"] },
  { term: "Catalyst", def: "An upcoming event that could move the stock (earnings, a product launch, a ruling).", why: "Catalysts are what turn a thesis into an actual price move — and the timing you watch for.", aliases: ["catalyst", "catalysts"] },
  { term: "Profitability", def: "Whether, and how much, the company earns after costs.", why: "Profitable companies depend less on raising money and survive downturns better.", aliases: ["profitability", "profitable"] },
  { term: "Free cash flow", def: "Cash left over after running the business and funding its investments.", why: "Real spendable cash — harder to fake than accounting profit. Funds buybacks, debt paydown, growth.", aliases: ["free cash flow", "fcf", "p/fcf"] },
  { term: "Guidance", def: "The company's own forecast for upcoming sales or profit.", why: "Markets often react more to guidance than to past results — it sets expectations.", aliases: ["guidance"] },
  { term: "Earnings", def: "The company's profit, reported each quarter.", why: "Earnings day is a major catalyst — beats and misses vs expectations move the stock.", aliases: ["earnings", "earnings report", "earnings print"] },
  { term: "Dilution", def: "When a company issues new shares, shrinking each existing share's slice.", why: "Dilution can quietly erode your returns even if the company grows.", aliases: ["dilution", "dilutive", "dilute"] },
  { term: "Moat", def: "A durable advantage that protects a company from competitors.", why: "A wide moat lets a company keep high margins and growth for longer.", aliases: ["moat", "competitive advantage"] },
  { term: "TAM", def: "Total Addressable Market — the full revenue opportunity if you captured the whole market.", why: "A big TAM means lots of room to grow; a small one caps the upside.", aliases: ["tam", "total addressable market"] },
  { term: "ARPU", def: "Average Revenue Per User — how much money each customer generates.", why: "Rising ARPU shows a company can earn more from the same customers.", aliases: ["arpu", "average revenue per user"] },
  { term: "EV/EBITDA", def: "Enterprise value divided by earnings before interest, tax, depreciation & amortization.", why: "A valuation measure that ignores debt and accounting noise — handy for comparing peers.", aliases: ["ev/ebitda", "ebitda"] },
  { term: "Debt-to-equity", def: "Total debt compared with shareholder equity.", why: "High debt-to-equity means more financial risk if business slows.", aliases: ["debt-to-equity", "debt to equity", "leverage"] },
  { term: "Short interest", def: "The share of a stock's float that traders have bet against (sold short).", why: "High short interest can fuel sharp 'short squeeze' rallies — or signal real doubt.", aliases: ["short interest", "short squeeze"] },
];

// Build a fast lookup from every alias/term to its entry, longest-first so
// multi-word terms ("free cash flow") match before single words ("cash").
const GLOSSARY_LOOKUP: { needle: string; entry: GlossaryEntry }[] = GLOSSARY.flatMap((e) =>
  [e.term, ...(e.aliases ?? [])].map((a) => ({ needle: a.toLowerCase(), entry: e })),
).sort((a, b) => b.needle.length - a.needle.length);

// Look up a glossary entry by its canonical term (used for static labels).
function glossaryFor(term: string): GlossaryEntry {
  return GLOSSARY.find((e) => e.term === term) ?? { term, def: "", why: "" };
}

/* A jargon term with a tap/click/focus popover definition.
   Uses Popover (not hover-only Tooltip) so it works on mobile via tap. */
function TermTip({ entry, children }: { entry: GlossaryEntry; children?: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline cursor-help underline decoration-dotted decoration-primary/60 underline-offset-2 hover:text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          data-testid={`term-${entry.term.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
          aria-label={`What is ${entry.term}?`}
        >
          {children ?? entry.term}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" align="start">
        <p className="font-black tracking-tight">{entry.term}</p>
        <p className="mt-1 leading-6 text-muted-foreground">{entry.def}</p>
        <p className="mt-2 leading-6"><span className="font-semibold text-primary">Why it matters: </span>{entry.why}</p>
      </PopoverContent>
    </Popover>
  );
}

/* A compact label that pairs text with a small (?) jargon-explainer popover. */
function TermLabel({ entry, children }: { entry: GlossaryEntry; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="text-muted-foreground/70 hover:text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-full" aria-label={`What is ${entry.term}?`}>
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 text-sm" align="start">
          <p className="font-black tracking-tight">{entry.term}</p>
          <p className="mt-1 leading-6 text-muted-foreground">{entry.def}</p>
          <p className="mt-2 leading-6"><span className="font-semibold text-primary">Why it matters: </span>{entry.why}</p>
        </PopoverContent>
      </Popover>
    </span>
  );
}

/* Renders a paragraph of (Claude- or mock-generated) text, wrapping the first
   occurrence of each known glossary term in a tappable TermTip. Case-insensitive,
   longest-match-first, and each distinct term is only linked once per block to
   avoid clutter. */
function Glossarize({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const used = new Set<string>();
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let guard = 0;

  while (remaining.length && guard++ < 400) {
    // Find the earliest unused glossary match in the remaining text.
    let best: { index: number; length: number; entry: GlossaryEntry } | null = null;
    const lower = remaining.toLowerCase();
    for (const { needle, entry } of GLOSSARY_LOOKUP) {
      if (used.has(entry.term)) continue;
      // Word-ish boundary so we don't match inside other words.
      let from = 0;
      while (from <= lower.length) {
        const idx = lower.indexOf(needle, from);
        if (idx === -1) break;
        const before = idx === 0 ? " " : lower[idx - 1];
        const after = idx + needle.length >= lower.length ? " " : lower[idx + needle.length];
        const boundaryOk = /[^a-z0-9]/.test(before) && /[^a-z0-9]/.test(after);
        if (boundaryOk) {
          if (!best || idx < best.index) best = { index: idx, length: needle.length, entry };
          break;
        }
        from = idx + 1;
      }
    }

    if (!best) {
      nodes.push(remaining);
      break;
    }

    if (best.index > 0) nodes.push(remaining.slice(0, best.index));
    const matched = remaining.slice(best.index, best.index + best.length);
    used.add(best.entry.term);
    nodes.push(
      <TermTip key={`${best.entry.term}-${nodes.length}`} entry={best.entry}>
        {matched}
      </TermTip>,
    );
    remaining = remaining.slice(best.index + best.length);
  }

  return <span className={className}>{nodes}</span>;
}

/* Collects the glossary terms that actually appear in the analysis text so we
   can render a compact "Terms explained" row when inline highlighting isn't
   enough on its own. */
function termsInText(...texts: string[]): GlossaryEntry[] {
  const hay = texts.join(" \n ").toLowerCase();
  const seen = new Set<string>();
  const found: GlossaryEntry[] = [];
  for (const { needle, entry } of GLOSSARY_LOOKUP) {
    if (seen.has(entry.term)) continue;
    const idx = hay.indexOf(needle);
    if (idx === -1) continue;
    const before = idx === 0 ? " " : hay[idx - 1];
    const after = idx + needle.length >= hay.length ? " " : hay[idx + needle.length];
    if (/[^a-z0-9]/.test(before) && /[^a-z0-9]/.test(after)) {
      seen.add(entry.term);
      found.push(entry);
    }
  }
  return found;
}

function biasTone(bias: string): string {
  switch (bias) {
    case "Bullish":
      return "text-emerald-600 dark:text-emerald-400";
    case "Bearish":
      return "text-destructive";
    case "Volatile":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

const ASSET_TABS: { key: "all" | "fx" | "crypto" | "stocks"; label: string; icon: typeof Radar }[] = [
  { key: "all", label: "All", icon: Radar },
  { key: "fx", label: "FX", icon: DollarSign },
  { key: "crypto", label: "Crypto", icon: Bitcoin },
  { key: "stocks", label: "Stocks", icon: CandlestickChart },
];

type NavItem = {
  icon: typeof Search;
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { icon: Search, label: "Find & Analyse", href: "/" },
  { icon: Radar, label: "Market Impact", href: "/market-impact" },
  { icon: MessageSquare, label: "AI Analyst", href: "/ai" },
];

/* ============================================================
   FIND & ANALYSE  (default home)
   Search → company cards each with "Run Analysis" → single report
   ============================================================ */
function AppShell() {
  const { toast } = useToast();
  const [query, setQuery] = useState("Rocket Lab");
  const [selectedTicker, setSelectedTicker] = useState<string | null>("RKLB");
  const [analysis, setAnalysis] = useState<GeneratedAnalysis | null>(null);
  const [dark, setDark] = useState(true);
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // ---- Company resolver search ----
  const searchKey = ["/api/companies/search", query.trim()] as const;
  const {
    data: matches,
    isLoading: searchLoading,
    isFetching: searchFetching,
  } = useQuery<Company[]>({
    queryKey: searchKey,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/companies/search?q=${encodeURIComponent(query.trim())}`,
      );
      return res.json();
    },
  });

  // ---- Discovery (compact list of overlooked names) ----
  const { data: discovery, isLoading: discoveryLoading } = useQuery<Company[]>({
    queryKey: ["/api/discovery"],
  });

  // ---- Watchlist ----
  const { data: watchlist } = useQuery<WatchlistEntry[]>({ queryKey: ["/api/watchlist"] });
  const watchedTickers = new Set((watchlist ?? []).map((w) => w.ticker));

  const addMutation = useMutation({
    mutationFn: async (ticker: string) => {
      const res = await apiRequest("POST", "/api/watchlist", { ticker });
      return res.json();
    },
    onSuccess: (_data, ticker) => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Added to watchlist", description: `${ticker} is now tracked.` });
    },
    onError: () => {
      toast({ title: "Could not add", description: "Please try again.", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (ticker: string) => {
      await apiRequest("DELETE", `/api/watchlist/${ticker}`);
      return ticker;
    },
    onSuccess: (ticker) => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Removed", description: `${ticker} removed from watchlist.` });
    },
  });

  // ---- The one analysis flow: always the merged alpha pipeline, server-side ----
  // Accepts an optional free-text query so unknown names ("Analyse this anyway")
  // resolve server-side into a transient company instead of dead-ending.
  const generateMutation = useMutation({
    mutationFn: async (arg: { ticker: string; query?: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/companies/${encodeURIComponent(arg.ticker)}/generate-analysis`,
        arg.query ? { query: arg.query } : {},
      );
      return res.json() as Promise<GeneratedAnalysis>;
    },
    onSuccess: (data) => {
      setAnalysis(data);
      toast({
        title: data.generatedBy === "claude" ? "Analysis ready" : "Analysis ready (mock)",
        description:
          data.generatedBy === "claude"
            ? `${data.ticker} analysed via Claude.`
            : "Live model unavailable — showing a structured fallback.",
      });
      // Scroll the report into view in the same page.
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    },
    onError: () => {
      toast({ title: "Analysis failed", description: "Please try again.", variant: "destructive" });
    },
  });

  // Run analysis for a specific ticker (select it first so the report is labelled correctly).
  const runAnalysis = (ticker: string) => {
    setSelectedTicker(ticker);
    setAnalysis(null);
    generateMutation.mutate({ ticker });
  };

  // Analyse a raw query that didn't match any seeded company. The server
  // resolves it into a transient company and returns a report with data gaps.
  const analyseAnyway = (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q) return;
    const guessTicker = (q.match(/[A-Za-z][A-Za-z0-9.]{0,5}/)?.[0] ?? q).toUpperCase().slice(0, 12);
    setSelectedTicker(guessTicker);
    setAnalysis(null);
    generateMutation.mutate({ ticker: guessTicker, query: q });
  };

  const pendingTicker = generateMutation.isPending ? selectedTicker : null;
  const isWatched = selectedTicker ? watchedTickers.has(selectedTicker) : false;

  return (
    <div className="grid h-dvh grid-cols-[280px_1fr] grid-rows-[auto_1fr] overflow-hidden bg-background max-lg:grid-cols-1">
      <Sidebar
        watchlist={watchlist ?? []}
        onSelectTicker={(t) => {
          setQuery(t);
          setSelectedTicker(t);
        }}
        onRemove={(t) => removeMutation.mutate(t)}
      />

      <header className="flex items-center justify-between border-b bg-card/70 px-6 py-4 backdrop-blur max-lg:px-4">
        <div className="flex items-center gap-3 lg:hidden">
          <Logo />
          <MobileNav />
        </div>
        <div className="max-lg:hidden">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Find · Analyse · Pressure-test</p>
          <h1 className="mt-1 text-xl font-black tracking-tight">Find high-potential stocks. Get a clear verdict.</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDark(!dark)} data-testid="button-theme-toggle" aria-label="Toggle theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="overflow-y-auto overscroll-contain p-6 max-lg:p-4">
        {/* Search + results */}
        <Card className="overflow-hidden border-card-border shadow-md">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
                  <Search className="h-5 w-5 text-primary" />
                  Find a stock
                </CardTitle>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Search by ticker or company, then hit <span className="font-semibold text-foreground">Run Analysis</span> on a card
                  to generate a full report below.
                </p>
              </div>
              <Badge variant="secondary" className="gap-1.5" data-testid="badge-result-count">
                {searchFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : `${matches?.length ?? 0} matches`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-12 rounded-xl border-input bg-background pl-10 text-base"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try Rocket Lab, RKLB, PLTR, IONQ, NBIS..."
                data-testid="input-company-search"
              />
            </div>
            <div className="mt-4 grid gap-3">
              {searchLoading ? (
                <>
                  <CompanySkeleton />
                  <CompanySkeleton />
                  <CompanySkeleton />
                </>
              ) : (matches?.length ?? 0) === 0 ? (
                <div className="rounded-xl border border-dashed border-card-border bg-card p-8 text-center" data-testid="empty-search">
                  <Search className="mx-auto h-7 w-7 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-bold">No seeded company matched “{query.trim()}”</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You can still run the analysis pipeline on it directly — the report will flag the live data it needs.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => analyseAnyway(query)}
                    disabled={generateMutation.isPending || !query.trim()}
                    data-testid="button-analyse-anyway"
                  >
                    {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {generateMutation.isPending ? "Analysing…" : `Analyse “${query.trim()}” anyway`}
                  </Button>
                  <p className="mt-3 text-xs text-muted-foreground/80">
                    Or try RKLB, PLTR, SOFI, IONQ, HIMS, NBIS, or a name like Rocket Lab.
                  </p>
                </div>
              ) : (
                matches!.map((company) => {
                  const watched = watchedTickers.has(company.ticker);
                  const selected = selectedTicker === company.ticker;
                  const running = pendingTicker === company.ticker;
                  return (
                    <div
                      key={company.ticker}
                      onClick={() => setSelectedTicker(company.ticker)}
                      className={`cursor-pointer rounded-xl border p-4 text-left text-foreground transition hover:shadow-sm ${
                        selected ? "border-primary bg-card shadow-sm ring-1 ring-primary/30" : "border-card-border bg-card"
                      }`}
                      data-testid={`card-company-${company.ticker}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-foreground">{company.name}</span>
                            <Badge variant="outline">{company.ticker}</Badge>
                            {watched ? (
                              <Badge variant="secondary" className="gap-1">
                                <Check className="h-3 w-3" /> Watching
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            {company.exchange} · {company.country} · {company.currency} · {company.marketCap}
                          </div>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            runAnalysis(company.ticker);
                          }}
                          disabled={generateMutation.isPending}
                          data-testid={`button-run-analysis-${company.ticker}`}
                        >
                          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          {running ? "Analysing…" : "Run Analysis"}
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{company.sector}</Badge>
                        <Badge variant={riskBadgeVariant(company.riskLevel)}>{company.riskLevel} risk</Badge>
                        <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-primary">
                          Score {company.score}/100 <ChevronRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Compact discovery strip */}
            <div className="mt-5 rounded-xl border border-card-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-black">
                <Gauge className="h-4 w-4 text-primary" />
                Overlooked names worth a look
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {discoveryLoading
                  ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
                  : (discovery ?? []).slice(0, 6).map((c) => (
                      <button
                        key={c.ticker}
                        onClick={() => {
                          setQuery(c.ticker);
                          setSelectedTicker(c.ticker);
                        }}
                        className="rounded-lg border border-card-border bg-background/40 p-3 text-left transition hover:border-primary/50 hover:bg-primary/5"
                        data-testid={`chip-discovery-${c.ticker}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black">{c.ticker}</span>
                          <span className="text-sm font-bold text-primary">{c.score}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{c.whyNow}</p>
                      </button>
                    ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* THE single report area */}
        <div ref={reportRef} className="mt-5 scroll-mt-6">
          {generateMutation.isPending ? (
            <Card className="border-card-border shadow-md">
              <CardContent className="space-y-3 p-5" data-testid="analysis-loading">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Running the alpha pipeline on {selectedTicker}…
                </div>
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </CardContent>
            </Card>
          ) : analysis ? (
            <Card className="border-card-border shadow-md">
              <CardContent className="p-5">
                <AnalysisOutput
                  analysis={analysis}
                  isWatched={isWatched}
                  onWatch={() => selectedTicker && addMutation.mutate(selectedTicker)}
                  onUnwatch={() => selectedTicker && removeMutation.mutate(selectedTicker)}
                  onRerun={() => selectedTicker && runAnalysis(selectedTicker)}
                  busy={addMutation.isPending || removeMutation.isPending}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-card-border">
              <CardContent className="p-10 text-center" data-testid="analysis-empty">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/12 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="mt-4 text-base font-black">No analysis yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                  Pick a stock above and press <span className="font-semibold text-foreground">Run Analysis</span>. You'll get a
                  verdict, what could make it work, valuation vs peers, the bear case, and what to watch next — all in one report.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <footer className="mt-6 rounded-xl border border-card-border bg-card p-4 text-xs leading-5 text-muted-foreground" data-testid="disclaimer-footer">
          <span className="font-bold text-foreground">Research tool only. Not financial advice.</span>{" "}
          Uses illustrative, non-live data and generated reports for your own workflow. Do your own research.
        </footer>
      </main>
    </div>
  );
}

function fmt(n: number | null, suffix = ""): string {
  if (n === null || n === undefined) return "—";
  return `${n}${suffix}`;
}

function PeerTable({ rows }: { rows: PeerRow[] }) {
  const best = Math.min(...rows.map((r) => r.valueGrowthScore));
  return (
    <div className="overflow-x-auto rounded-xl border border-card-border">
      <table className="w-full text-sm" data-testid="table-peers">
        <thead className="bg-secondary text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5">Ticker</th>
            <th className="px-3 py-2.5 text-right"><span className="inline-flex justify-end"><TermLabel entry={glossaryFor("P/S TTM")}>P/S TTM</TermLabel></span></th>
            <th className="px-3 py-2.5 text-right">P/S Fwd</th>
            <th className="px-3 py-2.5 text-right"><span className="inline-flex justify-end"><TermLabel entry={glossaryFor("Free cash flow")}>P/FCF</TermLabel></span></th>
            <th className="px-3 py-2.5 text-right"><span className="inline-flex justify-end"><TermLabel entry={glossaryFor("EV/EBITDA")}>EV/EBITDA</TermLabel></span></th>
            <th className="px-3 py-2.5 text-right"><span className="inline-flex justify-end"><TermLabel entry={glossaryFor("Gross margin")}>Gross %</TermLabel></span></th>
            <th className="px-3 py-2.5 text-right"><span className="inline-flex justify-end"><TermLabel entry={glossaryFor("Revenue growth")}>Rev YoY</TermLabel></span></th>
            <th className="px-3 py-2.5 text-right">V/G</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.ticker}
              className={`border-t border-card-border ${r.isSubject ? "bg-primary/8 font-semibold" : "bg-card"}`}
              data-testid={`peer-row-${r.ticker}`}
            >
              <td className="px-3 py-2.5">
                <span className="font-black">{r.ticker}</span>
                {r.isSubject ? <Badge variant="outline" className="ml-2 text-[10px]">subject</Badge> : null}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.psTtm)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.psFwd)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.pFcf)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{r.evEbitda ? r.evEbitda : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.grossMargin, "%")}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.revGrowth, "%")}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${r.valueGrowthScore === best ? "text-primary" : ""}`}>
                {r.valueGrowthScore.toFixed(2)}
                {r.valueGrowthScore === best ? " ★" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BulletGroup({ icon: Icon, label, items }: { icon: typeof Target; label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-xl border border-card-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-black">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm leading-6 text-muted-foreground">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/* Live-data status banner + quote snapshot. Three states:
   live (Finnhub) · live unavailable (key set, calls failed) · fallback (no key). */
function LiveStatusBar({ live, isMock }: { live: LiveMarketData | null; isMock: boolean }) {
  const status = live?.dataStatus ?? "no_key";
  const isLive = status === "live" && Boolean(live?.quote || live?.metrics || live?.profile || (live?.companyNews.length ?? 0));

  let label: string;
  let tone: string;
  if (isLive) {
    label = "Live via Finnhub";
    tone = "border-emerald-500/40 text-emerald-600 dark:text-emerald-400";
  } else if (status === "unavailable") {
    label = "Live data unavailable (feed error)";
    tone = "border-amber-500/40 text-amber-600 dark:text-amber-400";
  } else {
    label = "Fallback mode — no live feed";
    tone = "border-card-border text-muted-foreground";
  }

  const q = live?.quote ?? null;
  const p = live?.profile ?? null;
  const up = (q?.percentChange ?? 0) >= 0;

  return (
    <div className="space-y-2" data-testid="live-data-label">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`gap-1 ${tone}`} data-testid="badge-live-status">
          <Activity className="h-3 w-3" /> {label}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {isLive
            ? `Quote/metrics/news pulled from Finnhub${live?.resolvedSymbol ? ` for ${live.resolvedSymbol}` : ""} — verify before acting.`
            : isMock
              ? "Using Claude + local seed context. Verdicts stay on WATCHLIST / NO EDGE until live data backs a stronger call."
              : "Generated with Claude on local seed context — verify figures against live sources before acting."}
        </span>
      </div>

      {isLive && q ? (
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-card-border bg-muted/40 px-3 py-2 text-sm"
          data-testid="quote-snapshot"
        >
          <span className="font-black tabular-nums">{q.current.toLocaleString()}</span>
          <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {fmtPct(q.percentChange)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            Day {q.low.toLocaleString()}–{q.high.toLocaleString()} · prev {q.previousClose.toLocaleString()}
          </span>
          {p ? (
            <span className="text-xs text-muted-foreground">
              {p.name}
              {p.marketCapitalization ? ` · ~$${(p.marketCapitalization / 1000).toFixed(1)}B mkt cap` : ""}
              {p.industry ? ` · ${p.industry}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const LEAN_TONE: Record<string, string> = {
  Bullish: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  Bearish: "border-destructive/40 text-destructive",
  Mixed: "border-amber-500/40 text-amber-600 dark:text-amber-400",
};

/* Section B — what the live data/news likely does to the stock. */
function MarketViewBlock({ view }: { view: GeneratedAnalysis["marketView"] }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-4" data-testid="market-view-block">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-base font-black">
          <Activity className="h-4 w-4 text-primary" />
          What the data &amp; news likely do
        </div>
        <Badge variant="outline" className={`${LEAN_TONE[view.lean] ?? ""}`} data-testid="badge-market-lean">
          {view.lean}
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground" data-testid="text-market-view">{view.summary}</p>
      {view.drivers.length ? (
        <ul className="mt-2 space-y-1">
          {view.drivers.map((d, i) => (
            <li key={i} className="flex gap-2 text-sm leading-6">
              <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* Decision-action presentation. Big, plain-language labels for the verdict badge. */
const DECISION_META: Record<
  DecisionAction,
  { label: string; blurb: string; variant: "default" | "secondary" | "destructive" | "outline"; ring: string; tone: string }
> = {
  BUY_CANDIDATE: { label: "Buy candidate", blurb: "Worth serious consideration now", variant: "default", ring: "border-emerald-500/40 bg-emerald-500/[0.06]", tone: "text-emerald-600 dark:text-emerald-400" },
  WAIT_FOR_PULLBACK: { label: "Wait", blurb: "Good company, wait for a better price", variant: "secondary", ring: "border-amber-500/40 bg-amber-500/[0.06]", tone: "text-amber-600 dark:text-amber-400" },
  WATCHLIST: { label: "Watch", blurb: "Track it — don't act yet", variant: "secondary", ring: "border-amber-500/30 bg-amber-500/[0.05]", tone: "text-amber-600 dark:text-amber-400" },
  AVOID: { label: "Avoid", blurb: "Not worth the risk right now", variant: "destructive", ring: "border-destructive/40 bg-destructive/[0.06]", tone: "text-destructive" },
  SELL_OR_AVOID: { label: "Sell / avoid", blurb: "Risks outweigh the upside", variant: "destructive", ring: "border-destructive/40 bg-destructive/[0.06]", tone: "text-destructive" },
  NO_EDGE: { label: "No edge", blurb: "Nothing actionable here yet", variant: "outline", ring: "border-card-border bg-muted/30", tone: "text-muted-foreground" },
};

const IMPACT_TONE: Record<string, string> = {
  Bullish: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  Bearish: "border-destructive/40 text-destructive",
  Mixed: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  Volatile: "border-amber-500/40 text-amber-600 dark:text-amber-400",
};

/* Section 0 — the decision-first plain-English card that LEADS the report.
   Answers: would I buy this now, what could it do to the stock, why, what kind
   of company is it, and the biggest risk — all in simple language with hover
   definitions for any jargon. */
function DecisionCard({ d, ticker }: { d: DecisionSummary; ticker: string }) {
  const meta = DECISION_META[d.action] ?? DECISION_META.NO_EDGE;
  const impactTone = IMPACT_TONE[d.expectedStockImpact.direction] ?? "";
  return (
    <div className={`rounded-2xl border-2 p-5 ${meta.ring}`} data-testid="decision-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className={`h-5 w-5 ${meta.tone}`} />
          <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Decision</span>
        </div>
        <div className="flex flex-col items-end">
          <Badge variant={meta.variant} className="text-base font-black" data-testid="badge-decision-action">
            {meta.label}
          </Badge>
          <span className="mt-1 text-[11px] text-muted-foreground">{meta.blurb}</span>
        </div>
      </div>

      {/* What I'd do with this stock */}
      <p className="mt-4 text-lg font-bold leading-7" data-testid="text-decision-plain">
        <Glossarize text={d.plainEnglish} />
      </p>

      {/* What this could do to the stock */}
      <div className="mt-4 rounded-xl border border-card-border bg-card/70 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">What this could do to the stock</span>
          <Badge variant="outline" className={impactTone} data-testid="badge-impact-direction">
            <Activity className="mr-1 h-3 w-3" />
            {d.expectedStockImpact.direction}
          </Badge>
        </div>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground" data-testid="text-impact-explanation">
          <Glossarize text={d.expectedStockImpact.explanation} />
        </p>
      </div>

      {/* Why */}
      {d.whyNow.length ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Why</p>
          <ul className="mt-1.5 space-y-1" data-testid="list-why-now">
            {d.whyNow.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm leading-6">
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
                <span><Glossarize text={r} /></span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Growth story + biggest risk */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-card-border bg-card/70 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> What kind of company is this?
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground" data-testid="text-growth-story">
            <Glossarize text={d.growthStory} />
          </p>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/[0.04] p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> Biggest risk
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground" data-testid="text-main-risk">
            <Glossarize text={d.mainRisk} />
          </p>
        </div>
      </div>

      <p className="mt-4 text-[11px] italic text-muted-foreground/80">
        Research verdict for {ticker} — not personalized financial advice.
      </p>
    </div>
  );
}

/* A compact "Terms explained" row — chips for every jargon term that appears in
   the analysis, each tappable for a plain-English definition. */
function TermsExplained({ entries }: { entries: GlossaryEntry[] }) {
  if (!entries.length) return null;
  return (
    <div className="rounded-xl border border-card-border bg-card p-3" data-testid="terms-explained">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <HelpCircle className="h-3.5 w-3.5 text-primary" /> Terms explained — tap any to define
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {entries.map((e) => (
          <span key={e.term} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            <TermTip entry={e} />
          </span>
        ))}
      </div>
    </div>
  );
}

/* The single, clean analysis report. Sections:
   Decision → Market view → Verdict → What could make this work → Valuation vs peers → Bear case → What to watch */
function AnalysisOutput({
  analysis,
  isWatched,
  onWatch,
  onUnwatch,
  onRerun,
  busy,
}: {
  analysis: GeneratedAnalysis;
  isWatched: boolean;
  onWatch: () => void;
  onUnwatch: () => void;
  onRerun: () => void;
  busy: boolean;
}) {
  const rating = RATING_META[analysis.generalVerdict.rating];
  const isMock = analysis.generatedBy === "mock";
  const d = analysis.decisionSummary;
  // Collect jargon that shows up across the analysis text for the "Terms explained" row.
  const glossaryHits = termsInText(
    d.plainEnglish,
    d.expectedStockImpact.explanation,
    d.growthStory,
    d.mainRisk,
    ...d.whyNow,
    analysis.marketView.summary,
    ...analysis.marketView.drivers,
    analysis.generalVerdict.why,
    analysis.deepDive.summary,
    ...analysis.peerValuation.note ? [analysis.peerValuation.note] : [],
  );
  return (
    <div className="space-y-5" data-testid="analysis-output">
      {/* Header + provenance + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-lg font-black tracking-tight">{analysis.ticker} · Alpha analysis</span>
          {isMock ? (
            <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400" data-testid="badge-mock-mode">
              <AlertTriangle className="h-3 w-3" /> mock
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1" data-testid="badge-generated-by">
              <CheckCircle2 className="h-3 w-3" /> Claude{analysis.model ? ` · ${analysis.model}` : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isWatched ? (
            <Button variant="outline" size="sm" onClick={onUnwatch} disabled={busy} data-testid="button-remove-watchlist">
              <X className="h-4 w-4" /> Watching
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onWatch} disabled={busy} data-testid="button-add-watchlist">
              <Plus className="h-4 w-4" /> Watchlist
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onRerun} data-testid="button-rerun-analysis">
            <Sparkles className="h-4 w-4" /> Re-run
          </Button>
        </div>
      </div>

      {/* Live-data status + quote snapshot (Finnhub when configured). */}
      <LiveStatusBar live={analysis.live} isMock={isMock} />

      {/* 0 — DECISION FIRST. The lead card: what I'd do, what it could do to the
          stock, why, what kind of company, biggest risk. */}
      <DecisionCard d={d} ticker={analysis.ticker} />

      {/* Plain-English definitions for any jargon in the analysis. */}
      <TermsExplained entries={glossaryHits} />

      {/* Supporting evidence below the decision. Market view + verdict are now
          secondary, lighter-weight cards rather than the lead. */}
      <details className="group rounded-2xl border border-card-border bg-card/60" data-testid="evidence-disclosure" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-black">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> The evidence behind the call
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <div className="space-y-4 px-4 pb-4">
          {/* What the live data/news likely does to the stock */}
          <MarketViewBlock view={analysis.marketView} />

          {/* Research verdict detail (secondary to the Decision card above) */}
          <div className="rounded-xl border border-card-border bg-card p-4" data-testid="verdict-block">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-4 w-4 ${rating.tone}`} />
                <span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Research verdict</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={rating.variant} className="text-sm" data-testid="badge-verdict-rating">{rating.label}</Badge>
                <Badge variant="outline">{analysis.generalVerdict.confidence} confidence</Badge>
              </div>
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground" data-testid="text-verdict-why">
              <Glossarize text={analysis.generalVerdict.why} />
            </p>
            {analysis.generalVerdict.keyConditions.length ? (
              <div className="mt-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">What would change this</p>
                <ul className="mt-1.5 space-y-1">
                  {analysis.generalVerdict.keyConditions.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                      <Flag className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span><Glossarize text={c} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </details>

      {/* 2 — What could make this stock work */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-base font-black">
          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          What could make this stock work
        </div>
        {analysis.deepDive.summary ? (
          <p className="rounded-xl border border-card-border bg-card p-3 text-sm leading-6">{analysis.deepDive.summary}</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <BulletGroup icon={Factory} label="Business model" items={analysis.deepDive.businessModel} />
          <BulletGroup icon={ShieldCheck} label="Moat & competition" items={analysis.deepDive.moatCompetition} />
          <BulletGroup icon={TrendingUp} label="Catalysts (12 mo)" items={analysis.deepDive.catalysts} />
          <BulletGroup icon={Scale} label="Asymmetry" items={analysis.deepDive.asymmetry} />
        </div>
      </div>

      {/* 3 — Valuation vs peers */}
      {analysis.peerValuation.rows.length ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-base font-black">
            <Scale className="h-4 w-4 text-primary" />
            Valuation vs peers
          </div>
          {analysis.peerValuation.summary ? (
            <p className="text-sm leading-6 text-muted-foreground">{analysis.peerValuation.summary}</p>
          ) : null}
          <PeerTable rows={analysis.peerValuation.rows} />
          {analysis.peerValuation.note ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{analysis.peerValuation.note}</p>
          ) : null}
        </div>
      ) : null}

      {/* 4 — Bear case */}
      {analysis.bearCase.redFlags.length ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-base font-black">
            <Skull className="h-4 w-4 text-destructive" />
            Bear case — top red flags by severity
          </div>
          {analysis.bearCase.summary ? (
            <p className="text-sm leading-6 text-muted-foreground">{analysis.bearCase.summary}</p>
          ) : null}
          {analysis.bearCase.redFlags.map((flag) => (
            <div key={flag.rank} className="rounded-xl border border-card-border bg-card p-4" data-testid={`bear-flag-${flag.rank}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-destructive/12 text-xs font-black text-destructive">
                    {flag.rank}
                  </span>
                  <span className="font-bold">{flag.title}</span>
                </div>
                <Badge variant={severityVariant(flag.severity)}>{flag.severity}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground"><span className="font-semibold text-foreground">Evidence: </span>{flag.detail}</p>
              {flag.whatWouldDisprove ? (
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground"><span className="font-semibold text-emerald-600 dark:text-emerald-400">What would disprove: </span>{flag.whatWouldDisprove}</p>
              ) : null}
              {flag.source ? (
                <p className="mt-2 text-xs font-medium text-muted-foreground/80">Source: {flag.source}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* 5 — What would change my mind / watchlist triggers */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-base font-black">
          <Eye className="h-4 w-4 text-primary" />
          What would change my mind · watchlist triggers
        </div>
        <div className="rounded-xl border border-card-border bg-card p-4">
          <ul className="space-y-1.5">
            {[
              ...analysis.deepDive.catalysts,
              ...analysis.generalVerdict.keyConditions,
            ]
              .slice(0, 5)
              .map((t, i) => (
                <li key={i} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span>{t}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>

      {isMock && analysis.debug ? (
        <p className="text-[11px] leading-5 text-muted-foreground/70" data-testid="text-debug">
          Live Claude unavailable ({analysis.debug}). Showing a structured fallback.
        </p>
      ) : null}
    </div>
  );
}

function CompanySkeleton() {
  return (
    <div className="rounded-xl border border-card-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}

function Sidebar({
  watchlist,
  onSelectTicker,
  onRemove,
}: {
  watchlist: WatchlistEntry[];
  onSelectTicker: (ticker: string) => void;
  onRemove: (ticker: string) => void;
}) {
  const [location, navigate] = useLocation();

  return (
    <aside className="row-span-2 flex flex-col border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground max-lg:hidden">
      <Link href="/" className="cursor-pointer">
        <Logo />
      </Link>
      <nav className="mt-8 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = location === item.href;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.href)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/68 hover:bg-sidebar-accent/70"
              }`}
              data-testid={`nav-${item.label.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and").replaceAll("--", "-")}`}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              {active ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-8">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-sidebar-foreground/55">
            Watchlist
          </span>
          <Badge variant="secondary" className="h-5 px-2 text-[11px]" data-testid="badge-watchlist-count">
            {watchlist.length}
          </Badge>
        </div>
        <div className="mt-3 space-y-1.5">
          {watchlist.length === 0 ? (
            <p className="rounded-lg border border-dashed border-sidebar-border px-3 py-3 text-xs leading-5 text-sidebar-foreground/55">
              Empty. Run an analysis and pin names you want to track.
            </p>
          ) : (
            watchlist.map((item) => (
              <div
                key={item.ticker}
                className="group flex items-center justify-between rounded-lg bg-sidebar-accent/50 px-3 py-2"
                data-testid={`row-watchlist-${item.ticker}`}
              >
                <button
                  className="flex flex-col items-start text-left"
                  onClick={() => {
                    if (location !== "/") navigate("/");
                    onSelectTicker(item.ticker);
                  }}
                  data-testid={`button-open-${item.ticker}`}
                >
                  <span className="text-sm font-bold">{item.ticker}</span>
                  <span className="text-[11px] text-sidebar-foreground/55">
                    {item.company ? `Score ${item.company.score}` : "—"}
                  </span>
                </button>
                <button
                  className="rounded-md p-1 text-sidebar-foreground/50 opacity-0 transition hover:text-destructive group-hover:opacity-100"
                  onClick={() => onRemove(item.ticker)}
                  aria-label={`Remove ${item.ticker}`}
                  data-testid={`button-remove-${item.ticker}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
          <ShieldAlert className="h-4 w-4" />
          Research tool only
        </div>
        <p className="mt-2 text-sm leading-6 text-sidebar-foreground/68">
          Not financial advice. Illustrative, non-live data.
        </p>
      </div>
    </aside>
  );
}

/* Compact segmented navigation shown only on mobile (the sidebar is hidden < lg). */
function MobileNav() {
  const [location, navigate] = useLocation();
  return (
    <nav
      className="flex items-center gap-1 rounded-full border bg-muted/60 p-1 lg:hidden"
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = location === item.href;
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.href)}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-background"
            }`}
            data-testid={`mobilenav-${item.label.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and").replaceAll("--", "-")}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </nav>
  );
}

/* ============================================================
   MARKET IMPACT
   ============================================================ */
function MarketImpactPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"all" | "fx" | "crypto" | "stocks">("all");
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const { data: watchlist } = useQuery<WatchlistEntry[]>({ queryKey: ["/api/watchlist"] });
  const removeMutation = useMutation({
    mutationFn: async (ticker: string) => {
      await apiRequest("DELETE", `/api/watchlist/${ticker}`);
      return ticker;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] }),
  });

  const { data, isLoading } = useQuery<{
    assetClass: string;
    live: boolean;
    events: MarketImpactEvent[];
    liveNews?: LiveMarketNewsItem[];
  }>({
    queryKey: ["/api/market-impact", tab],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/market-impact?assetClass=${tab}`);
      return res.json();
    },
  });
  const events = data?.events ?? [];
  const liveNews = data?.liveNews ?? [];
  const isLive = Boolean(data?.live);

  return (
    <div className="grid h-dvh grid-cols-[280px_1fr] grid-rows-[auto_1fr] overflow-hidden bg-background max-lg:grid-cols-1">
      <Sidebar
        watchlist={watchlist ?? []}
        onSelectTicker={() => navigate("/")}
        onRemove={(t) => removeMutation.mutate(t)}
      />

      <header className="flex items-center justify-between border-b bg-card/70 px-6 py-4 backdrop-blur max-lg:px-4">
        <div className="flex items-center gap-3 lg:hidden">
          <Logo />
          <MobileNav />
        </div>
        <div className="max-lg:hidden">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Multi-asset event radar</p>
          <h1 className="mt-1 text-xl font-black tracking-tight">Market Impact — what could move FX, crypto and stocks</h1>
        </div>
        <div className="flex items-center gap-2">
          {isLive ? (
            <Badge variant="outline" className="gap-1.5 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 max-sm:hidden" data-testid="badge-live-news">
              <Activity className="h-3.5 w-3.5" /> Live news via Finnhub
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 border-amber-500/50 text-amber-600 dark:text-amber-400 max-sm:hidden" data-testid="badge-seeded">
              <AlertTriangle className="h-3.5 w-3.5" /> Seeded scenarios
            </Badge>
          )}
          <Button variant="outline" size="icon" onClick={() => setDark(!dark)} aria-label="Toggle theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="overflow-y-auto overscroll-contain p-6 max-lg:p-4">
        {liveNews.length ? (
          <Card className="mb-6 border-card-border shadow-md" data-testid="live-news-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
                <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Live headlines, classified
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pulled live from Finnhub and tagged bullish / bearish / mixed / volatility with the symbols mentioned.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {liveNews.map((n) => (
                <LiveNewsRow key={n.id || n.headline} item={n} />
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-card-border shadow-md">
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
                <Radar className="h-5 w-5 text-primary" />
                Top 5 events that could move markets
              </CardTitle>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                For each event: the affected symbols, the likely direction, a bull and a bear scenario, how violent the move
                could be, and what to watch.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
              <TabsList className="grid w-full grid-cols-4" data-testid="tabs-asset-class">
                {ASSET_TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <TabsTrigger key={t.key} value={t.key} data-testid={`tab-asset-${t.key}`}>
                      <Icon className="mr-1.5 h-3.5 w-3.5" />
                      {t.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {ASSET_TABS.map((t) => (
                <TabsContent key={t.key} value={t.key} className="mt-4 space-y-3">
                  {isLoading ? (
                    [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)
                  ) : events.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-card-border p-8 text-center text-sm text-muted-foreground">
                      No events seeded for this asset class yet.
                    </p>
                  ) : (
                    events.map((ev) => <MarketImpactCard key={ev.id} ev={ev} />)
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <footer className="mt-6 rounded-xl border border-card-border bg-card p-4 text-xs leading-5 text-muted-foreground">
          <span className="font-bold text-foreground">Not financial advice.</span>{" "}
          {isLive
            ? "Headlines are live via Finnhub; the scenario cards below remain illustrative templates. Confirm exact timing and figures against primary sources."
            : "The scenario cards are illustrative templates. Add a FINNHUB_API_KEY to attach live, classified headlines. Confirm live dates and figures against primary sources."}
        </footer>
      </main>
    </div>
  );
}

function newsBiasTone(bias: string): string {
  switch (bias) {
    case "Bullish":
      return "border-emerald-500/40 text-emerald-600 dark:text-emerald-400";
    case "Bearish":
      return "border-destructive/40 text-destructive";
    case "Volatility":
      return "border-amber-500/40 text-amber-600 dark:text-amber-400";
    default:
      return "border-card-border text-muted-foreground";
  }
}

/* Plain-English read of what a classified headline likely means for price. */
function newsImpactPlain(item: LiveMarketNewsItem): string {
  const who = item.affected.length ? item.affected.slice(0, 4).join(", ") : "the names it mentions";
  switch (item.bias) {
    case "Bullish":
      return `Likely a positive read for ${who} — the kind of headline that can lift the price if the market believes it.`;
    case "Bearish":
      return `Likely a negative read for ${who} — the kind of headline that can pressure the price near-term.`;
    case "Volatility":
      return `Could swing ${who} sharply either way — expect bigger moves, not a clear direction.`;
    default:
      return `Mixed read for ${who} — no clear single direction; watch how the market actually reacts.`;
  }
}

function LiveNewsRow({ item }: { item: LiveMarketNewsItem }) {
  const when = item.datetime ? new Date(item.datetime * 1000).toLocaleDateString() : "";
  return (
    <a
      href={item.url || "#"}
      target={item.url ? "_blank" : undefined}
      rel="noreferrer"
      className="block rounded-lg border border-card-border bg-muted/30 px-3 py-2 hover:bg-muted/60"
      data-testid="live-news-row"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.headline}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.source}
            {when ? ` · ${when}` : ""}
            {item.affected.length ? ` · ${item.affected.join(", ")}` : ""}
          </p>
        </div>
        <Badge variant="outline" className={`shrink-0 ${newsBiasTone(item.bias)}`}>{item.bias}</Badge>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground" data-testid="news-impact-plain">
        <span className="font-semibold text-foreground">Likely impact: </span>{newsImpactPlain(item)}
      </p>
    </a>
  );
}

function volTone(risk: string): string {
  if (risk === "High") return "border-destructive/50 text-destructive";
  if (risk === "Medium") return "border-amber-500/50 text-amber-600 dark:text-amber-400";
  return "border-card-border text-muted-foreground";
}

function MarketImpactCard({ ev }: { ev: MarketImpactEvent }) {
  const bias = ev.marketBias ?? ev.expectedDirectionBias;
  return (
    <div className="rounded-xl border border-card-border bg-card p-4" data-testid={`event-${ev.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <div className="font-black">{ev.eventName}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-wide">{ev.assetClass}</span>
              <span>·</span>
              <span className="tabular-nums">{ev.dateTime}</span>
              {ev.whenLabel ? (
                <>
                  <span>·</span>
                  <span className="font-semibold text-primary">{ev.whenLabel}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant={impactBadgeVariant(ev.impactLevel)}>{ev.impactLevel} impact</Badge>
          <Badge variant="outline" className={biasTone(bias)}>
            <Activity className="mr-1 h-3 w-3" />
            {bias}
          </Badge>
          <Badge variant="outline" className={volTone(ev.volatilityRisk)}>
            {ev.volatilityRisk} vol
          </Badge>
        </div>
      </div>

      {/* Affected symbols */}
      <div className="mt-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Symbols</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ev.affectedSymbols.map((s) => (
            <Badge key={s} variant="secondary" className="font-mono text-[11px]">{s}</Badge>
          ))}
        </div>
      </div>

      {/* Bull / Bear scenarios */}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3" data-testid={`bull-${ev.id}`}>
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" /> Bull case
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{ev.bullCase}</p>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" data-testid={`bear-${ev.id}`}>
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-destructive">
            <TrendingDown className="h-3.5 w-3.5" /> Bear case
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{ev.bearCase}</p>
        </div>
      </div>

      {/* Why + watch */}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="flex items-start gap-2">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm leading-6 text-muted-foreground">
            <span className="font-semibold text-foreground">Why it matters. </span>{ev.whyItMatters}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm leading-6 text-muted-foreground">
            <span className="font-semibold text-foreground">What to watch. </span>{ev.whatToWatch}
          </p>
        </div>
      </div>

      <p className="mt-3 border-t border-card-border pt-2 text-[11px] text-muted-foreground/70">
        Source: {ev.sourceLabel}
      </p>
    </div>
  );
}

/* ============================================================
   AI ANALYST
   ============================================================ */
type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  generatedBy?: "claude" | "mock";
};

const STARTER_PROMPTS = [
  { label: "What's the market impact if SpaceX IPOs?" },
  { label: "Analyse RKLB and give me a verdict", ticker: "RKLB" },
  { label: "What could move BTC this week?" },
  { label: "Compare NBIS vs CRDO" },
];

function renderChatLine(line: string, key: number) {
  const trimmed = line.trim();
  if (!trimmed) return <div key={key} className="h-2" />;
  // **bold** heading lines
  const boldMatch = trimmed.match(/^\*\*(.+?)\*\*:?$/);
  if (boldMatch) {
    return (
      <p key={key} className="mt-3 font-black tracking-tight first:mt-0">
        {boldMatch[1]}
      </p>
    );
  }
  // italic-only line (e.g. caveat)
  const italicMatch = trimmed.match(/^_(.+)_$/);
  if (italicMatch) {
    return (
      <p key={key} className="mt-2 text-xs italic leading-5 text-muted-foreground/80">
        {italicMatch[1]}
      </p>
    );
  }
  // bullet / numbered list items, with inline **bold** support
  const isBullet = /^([-*]|\d+\.)\s+/.test(trimmed);
  const content = trimmed.replace(/^([-*]|\d+\.)\s+/, "");
  const parts = content.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
    seg.startsWith("**") && seg.endsWith("**") ? (
      <strong key={i} className="font-bold text-foreground">{seg.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );
  if (isBullet) {
    return (
      <p key={key} className="ml-4 flex gap-2 text-sm leading-6 text-muted-foreground">
        <span className="text-primary">•</span>
        <span>{parts}</span>
      </p>
    );
  }
  return (
    <p key={key} className="text-sm leading-6 text-muted-foreground">{parts}</p>
  );
}

function AiAnalystPage() {
  const { toast } = useToast();
  const [dark, setDark] = useState(true);
  const [input, setInput] = useState("");
  const [ticker, setTicker] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const { data: watchlist } = useQuery<WatchlistEntry[]>({ queryKey: ["/api/watchlist"] });
  const removeMutation = useMutation({
    mutationFn: async (t: string) => {
      await apiRequest("DELETE", `/api/watchlist/${t}`);
      return t;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] }),
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const cleanTicker = ticker.trim().toUpperCase();
      const res = await apiRequest("POST", "/api/ai/chat", {
        message,
        context: cleanTicker ? { selectedTicker: cleanTicker, method: "alpha" } : { method: "alpha" },
      });
      return res.json() as Promise<AiChatResponse>;
    },
    onSuccess: (data) => {
      setTurns((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", text: data.reply, generatedBy: data.generatedBy },
      ]);
    },
    onError: () => {
      toast({ title: "Request failed", description: "Please try again.", variant: "destructive" });
    },
  });

  // Auto-scroll to the newest turn.
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, chatMutation.isPending]);

  const send = (raw: string, presetTicker?: string) => {
    const message = raw.trim();
    if (!message || chatMutation.isPending) return;
    if (presetTicker) setTicker(presetTicker);
    setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: message }]);
    setInput("");
    chatMutation.mutate(message);
  };

  return (
    <div className="grid h-dvh grid-cols-[280px_1fr] grid-rows-[auto_1fr] overflow-hidden bg-background max-lg:grid-cols-1">
      <Sidebar
        watchlist={watchlist ?? []}
        onSelectTicker={(t) => setTicker(t)}
        onRemove={(t) => removeMutation.mutate(t)}
      />

      <header className="flex items-center justify-between border-b bg-card/70 px-6 py-4 backdrop-blur max-lg:px-4">
        <div className="flex items-center gap-3 lg:hidden">
          <Logo />
          <MobileNav />
        </div>
        <div className="max-lg:hidden">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Built-in research assistant</p>
          <h1 className="mt-1 text-xl font-black tracking-tight">AI Analyst — scenarios, catalysts, and market impact</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDark(!dark)} aria-label="Toggle theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-col overflow-hidden p-6 max-lg:p-4">
        <Card className="flex min-h-0 flex-1 flex-col border-card-border shadow-md">
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
              <MessageSquare className="h-5 w-5 text-primary" />
              Ask the analyst
            </CardTitle>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Ask about a stock, an upcoming catalyst, an IPO, a valuation question, or a peer comparison. You'll get a
              practical market-impact read — affected tickers, bull/bear scenarios, and what to watch.
            </p>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            {/* Optional ticker focus */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Focus ticker</span>
              <Input
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="optional, e.g. RKLB"
                className="h-8 w-44 font-mono uppercase"
                data-testid="input-ai-ticker"
              />
            </div>

            {/* Scrollable response area */}
            <ScrollArea ref={scrollRef} className="min-h-0 flex-1 rounded-xl border border-card-border bg-background/40" data-testid="area-ai-responses">
              <div className="space-y-4 p-4">
                {turns.length === 0 && !chatMutation.isPending ? (
                  <div className="py-8 text-center">
                    <Sparkles className="mx-auto h-7 w-7 text-primary" />
                    <p className="mt-3 text-sm font-semibold">Start with a question, or try one of these:</p>
                    <div className="mx-auto mt-4 grid max-w-xl gap-2 sm:grid-cols-2">
                      {STARTER_PROMPTS.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => send(p.label, p.ticker)}
                          className="rounded-lg border border-card-border bg-card px-3 py-2.5 text-left text-sm font-medium transition hover:border-primary/60 hover:bg-primary/5"
                          data-testid={`button-starter-${p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  turns.map((turn) => (
                    <div key={turn.id} className="flex gap-3" data-testid={`turn-${turn.role}-${turn.id}`}>
                      <div
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                          turn.role === "user" ? "bg-foreground/10 text-foreground" : "bg-primary/15 text-primary"
                        }`}
                      >
                        {turn.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            {turn.role === "user" ? "You" : "AI Analyst"}
                          </span>
                          {turn.role === "assistant" && turn.generatedBy === "mock" ? (
                            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">offline</Badge>
                          ) : null}
                          {turn.role === "assistant" && turn.generatedBy === "claude" ? (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Claude</Badge>
                          ) : null}
                        </div>
                        <div className="mt-1">
                          {turn.role === "user" ? (
                            <p className="text-sm leading-6">{turn.text}</p>
                          ) : (
                            turn.text.split("\n").map((line, i) => renderChatLine(line, i))
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {chatMutation.isPending ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="status-ai-loading">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Analysing…
                  </div>
                ) : null}

                {chatMutation.isError ? (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="status-ai-error">
                    <AlertTriangle className="h-4 w-4" />
                    Something went wrong. Try sending again.
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            {/* Composer */}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask about a stock, catalyst, IPO, valuation, or peer comparison…"
                className="min-h-[52px] max-h-40 resize-none"
                data-testid="input-ai-chat"
              />
              <Button
                type="submit"
                size="icon"
                className="h-[52px] w-[52px] shrink-0"
                disabled={!input.trim() || chatMutation.isPending}
                aria-label="Send message"
                data-testid="button-ai-send"
              >
                {chatMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </form>
          </CardContent>
        </Card>

        <footer className="mt-4 rounded-xl border border-card-border bg-card p-4 text-xs leading-5 text-muted-foreground">
          <span className="font-bold text-foreground">Research and analysis only, not personalized financial advice.</span>{" "}
          Live timing, prices and filings need live sources — verify before acting.
        </footer>
      </main>
    </div>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={AppShell} />
      <Route path="/market-impact" component={MarketImpactPage} />
      <Route path="/ai" component={AiAnalystPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
