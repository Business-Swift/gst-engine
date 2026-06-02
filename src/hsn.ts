/**
 * hsn.ts — FlexSearch-powered HSN/SAC code lookup engine
 * Part of gst-engine | Developed by Business Swift | Made in India 🇮🇳
 *
 * Lazy-loads hsn_search.json (~25 K records) on first hydrate() call.
 * Concurrent calls share a single in-flight promise (singleton guarantee).
 *
 * @copyright 2026 Business Swift. All rights reserved.
 * See the LICENSE file for full terms.
 */

import { Document } from "flexsearch";
import type {
  ChapterSeo,
  CodeHierarchy,
  HsnRecord,
  Rate,
  RawRate,
  SearchOptions,
  SearchResult,
} from "./hsn-types";
import { getChapterSeo } from "./seo";

// ─────────────────────────────────────────────────────────────────────────────
// Internal index document shape (stored in FlexSearch)
// ─────────────────────────────────────────────────────────────────────────────

interface IndexDoc {
  id: number;
  code: string;
  ch: string;
  name: string;
  keywords: string;
  desc: string; // rates[].desc joined — indexed as "description"
  rates: RawRate[];
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton state
// ─────────────────────────────────────────────────────────────────────────────

let index: Document<IndexDoc, true> | null = null;
let hydratePromise: Promise<void> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Hydration
// ─────────────────────────────────────────────────────────────────────────────

function buildIndex(records: HsnRecord[]): Document<IndexDoc, true> {
  const doc = new Document<IndexDoc, true>({
    document: {
      id: "id",
      index: [
        { field: "code", tokenize: "forward", resolution: 10 },
        { field: "name", tokenize: "forward", resolution: 8 },
        { field: "keywords", tokenize: "full", resolution: 7 },
        { field: "desc", tokenize: "full", resolution: 5 },
        { field: "ch", tokenize: "strict", resolution: 3 },
      ],
      store: true,
    },
  });

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    doc.add({
      id: i,
      code: r.code,
      ch: r.ch,
      name: r.name,
      keywords: r.keywords ?? "",
      desc: r.rates.map((rt) => rt.desc).join(" "),
      rates: r.rates,
      updatedAt: r.updatedAt,
    });
  }

  return doc;
}

/**
 * Loads hsn_search.json and builds the FlexSearch index.
 * Idempotent — subsequent calls return immediately.
 * Concurrent calls share the same in-flight promise.
 */
export async function hydrate(): Promise<void> {
  if (index !== null) return;
  if (hydratePromise !== null) return hydratePromise;

  hydratePromise = (async () => {
    const mod = await import("./resources/hsn_search.json");
    const records = mod.default as HsnRecord[];
    index = buildIndex(records);
  })();

  return hydratePromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate enrichment helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseDateOrdinal(from: string): number {
  // Handles both "DD/MM/YYYY" and "D/MM/YYYY" (some SAC records omit leading zero)
  const parts = from.split("/");
  if (parts.length !== 3) return 0;
  const [d, m, y] = parts;
  return Number(y) * 10000 + Number(m) * 100 + Number(d);
}

function enrichRates(rawRates: RawRate[]): Rate[] {
  if (rawRates.length === 0) return [];

  const withOrdinals = rawRates.map((r) => ({
    ...r,
    ord: parseDateOrdinal(r.from),
    isCurrent: false,
  }));

  const maxOrd = Math.max(...withOrdinals.map((r) => r.ord));

  const rates: Rate[] = withOrdinals
    .map((r) => ({ pct: r.pct, desc: r.desc, from: r.from, isCurrent: r.ord === maxOrd }))
    .sort((a, b) => parseDateOrdinal(b.from) - parseDateOrdinal(a.from));

  return rates;
}

// ─────────────────────────────────────────────────────────────────────────────
// Result builder
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_SEO: ChapterSeo = {
  name: "",
  slug: "",
  metaTitle: "",
  metaDescription: "",
};

function buildResult(
  doc: IndexDoc,
  matchedOn: SearchResult["matchedOn"],
): SearchResult {
  const rates = enrichRates(doc.rates);
  const currentRate = rates.find((r) => r.isCurrent)?.pct ?? rates[0]?.pct ?? "0";
  const chapterSeo = getChapterSeo(doc.ch);

  return {
    code: doc.code,
    type: doc.ch === "99" ? "SAC" : "HSN",
    name: doc.name,
    currentRate: `${currentRate}%`,
    rates,
    chapter: {
      number: doc.ch,
      name: chapterSeo?.name ?? "",
    },
    seo: chapterSeo ?? FALLBACK_SEO,
    updatedAt: doc.updatedAt,
    matchedOn,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Field → matchedOn mapping (priority order)
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_PRIORITY: Array<[string, SearchResult["matchedOn"]]> = [
  ["code", "code"],
  ["name", "name"],
  ["keywords", "keywords"],
  ["desc", "description"],
  ["ch", undefined],
];

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full-text typeahead search over HSN/SAC codes and descriptions.
 * Calls hydrate() automatically on first invocation.
 */
export async function search(
  query: string,
  opts: SearchOptions = {},
): Promise<SearchResult[]> {
  await hydrate();

  const limit = Math.min(opts.limit ?? 10, 50);
  const fetchLimit = limit * 5; // over-fetch to allow post-filtering

  // FlexSearch Document.search with enrich:true returns stored docs per field.
  // The type declarations mis-type the unit result (id: Id[] should be id: Id),
  // so we cast to the real runtime shape.
  type EnrichedUnit = { id: number; doc: IndexDoc };
  type EnrichedSet = { field: string; result: EnrichedUnit[] };

  const raw = index!.search<true>(query, fetchLimit, {
    enrich: true,
  }) as unknown as EnrichedSet[];

  // Merge results across fields, highest-priority field wins for matchedOn.
  // Deduplicate by code string (source data may contain duplicate records).
  const seen = new Set<string>();
  const ordered: Array<{ doc: IndexDoc; matchedOn: SearchResult["matchedOn"] }> = [];

  for (const [fieldName, matchedOn] of FIELD_PRIORITY) {
    const set = raw.find((s) => s.field === fieldName);
    if (!set) continue;
    for (const unit of set.result) {
      if (seen.has(unit.doc.code)) continue;
      seen.add(unit.doc.code);
      ordered.push({ doc: unit.doc, matchedOn });
    }
  }

  const results: SearchResult[] = [];
  for (const { doc, matchedOn } of ordered) {
    if (opts.type && (doc.ch === "99" ? "SAC" : "HSN") !== opts.type) continue;
    if (opts.chapter && doc.ch !== opts.chapter) continue;
    results.push(buildResult(doc, matchedOn));
    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Exact lookup by HSN/SAC code. Returns null when not found.
 * Calls hydrate() automatically on first invocation.
 */
export async function getByCode(code: string): Promise<SearchResult | null> {
  await hydrate();

  // FlexSearch strict tokenizer on code field: exact match on full code
  type EnrichedUnit = { id: number; doc: IndexDoc };
  type EnrichedSet = { field: string; result: EnrichedUnit[] };

  const raw = index!.search<true>(code, 50, {
    enrich: true,
    index: ["code"],
  }) as unknown as EnrichedSet[];

  const codeSet = raw.find((s) => s.field === "code");
  if (!codeSet) return null;

  const hit = codeSet.result.find((u) => u.doc.code === code);
  return hit ? buildResult(hit.doc, "code") : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// parseCode — pure synchronous helper, no hydration needed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses an HSN or SAC code string into its hierarchical components.
 *
 * | Length | Level | Description     |
 * |--------|-------|-----------------|
 * | 2      | 1     | Chapter         |
 * | 4      | 2     | Heading         |
 * | 6      | 3     | Sub-heading     |
 * | 8      | 4     | Tariff item     |
 * | other  | 0     | Unrecognised    |
 */
export function parseCode(code: string): CodeHierarchy {
  const clean = code.trim();
  switch (clean.length) {
    case 2:
      return {
        level: 1,
        chapter: clean,
        heading: null,
        subheading: null,
        tariff: null,
      };
    case 4:
      return {
        level: 2,
        chapter: clean.slice(0, 2),
        heading: clean,
        subheading: null,
        tariff: null,
      };
    case 6:
      return {
        level: 3,
        chapter: clean.slice(0, 2),
        heading: clean.slice(0, 4),
        subheading: clean,
        tariff: null,
      };
    case 8:
      return {
        level: 4,
        chapter: clean.slice(0, 2),
        heading: clean.slice(0, 4),
        subheading: clean.slice(0, 6),
        tariff: clean,
      };
    default:
      return {
        level: 0,
        chapter: null,
        heading: null,
        subheading: null,
        tariff: null,
      };
  }
}
