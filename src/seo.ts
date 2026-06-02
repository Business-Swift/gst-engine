/**
 * seo.ts — Synchronous chapter SEO helpers
 * Part of gst-engine | Developed by Business Swift | Made in India 🇮🇳
 *
 * Importing this module does NOT pull in the FlexSearch index or hsn_search.json.
 * chapters_seo.json is ~20 KB and loaded at module init for synchronous access.
 *
 * @copyright 2026 Business Swift. All rights reserved.
 * See the LICENSE file for full terms.
 */

import type { ChapterSeo } from "./hsn-types";
import chaptersRaw from "./resources/chapters_seo.json";

const chaptersMap = chaptersRaw as Record<string, ChapterSeo>;

export function getChapterSeo(chapterNumber: string): ChapterSeo | null {
  return chaptersMap[chapterNumber] ?? null;
}

export function getChapterName(chapterNumber: string): string | null {
  return chaptersMap[chapterNumber]?.name ?? null;
}
