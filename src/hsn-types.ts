/**
 * hsn-types.ts — TypeScript interfaces for HSN/SAC search engine
 * Part of gst-engine | Developed by Business Swift | Made in India 🇮🇳
 *
 * @copyright 2026 Business Swift. All rights reserved.
 * See the LICENSE file for full terms.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Raw JSON shapes (as stored in hsn_search.json / chapters_seo.json)
// ─────────────────────────────────────────────────────────────────────────────

export interface RawRate {
  pct: string;
  desc: string;
  from: string; // DD/MM/YYYY
}

export interface HsnRecord {
  code: string;
  ch: string;
  name: string;
  rates: RawRate[];
  updatedAt: string;
  keywords?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface Rate {
  pct: string;
  desc: string;
  from: string; // DD/MM/YYYY
  isCurrent: boolean;
}

export interface ChapterSeo {
  name: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
}

export interface SearchResult {
  code: string;
  type: "HSN" | "SAC";
  name: string;
  currentRate: string; // e.g. "18%"
  rates: Rate[]; // newest-first, isCurrent set on most recent from date
  chapter: {
    number: string;
    name: string;
  };
  seo: ChapterSeo;
  updatedAt: string;
  matchedOn?: "code" | "name" | "keywords" | "description";
}

export interface SearchOptions {
  limit?: number; // default 10, max 50
  type?: "HSN" | "SAC";
  chapter?: string; // 2-digit chapter code
}

export interface CodeHierarchy {
  chapter: string | null; // 2-digit, e.g. "84"
  heading: string | null; // 4-digit, e.g. "8471"
  subheading: string | null; // 6-digit, e.g. "847130"
  tariff: string | null; // 8-digit, e.g. "84713010"
  level: 0 | 1 | 2 | 3 | 4;
}
