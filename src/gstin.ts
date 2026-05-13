/**
 * gstin.ts — GSTIN validation, normalisation, and state-code utilities
 * Part of gst-engine | Developed by Business Swift | Made in India 🇮🇳
 *
 * @copyright 2026 Business Swift. All rights reserved.
 * See the LICENSE file for full terms.
 */

import { RegistrationType, StateCode } from "./types";

// GSTIN format: 2-digit state + 10-char PAN + 1-digit entity + Z + 1-char checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Returns true if the GSTIN passes format and checksum validation.
 */
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin) return false;
  const g = gstin.toUpperCase().trim();
  if (!GSTIN_REGEX.test(g)) return false;
  return verifyChecksum(g);
}

/**
 * Returns true if the GSTIN matches the 15-character structural format,
 * regardless of checksum. Used for state code extraction.
 */
export function isStructurallyValidGSTIN(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin.toUpperCase().trim());
}

/**
 * Normalises a GSTIN to uppercase trimmed form.
 * Accepts structurally valid GSTINs even when the checksum differs
 * (e.g. draft invoices, test data), so state code extraction always works.
 * Returns undefined only for completely malformed input.
 */
export function normaliseGSTIN(gstin?: string): string | undefined {
  if (!gstin) return undefined;
  const g = gstin.toUpperCase().trim();
  return isStructurallyValidGSTIN(g) ? g : undefined;
}

/**
 * Extracts the 2-digit state code from a valid GSTIN.
 */
export function getStateCodeFromGSTIN(gstin: string): string {
  return gstin.substring(0, 2);
}

/**
 * Infers the registration type from the GSTIN entity code (position 12, 0-indexed).
 * - Digit 1–9 → REGULAR
 * - R → REGULAR (rare variant)
 * - C → COMPOSITION (not standard but used in older GSTINs)
 * The 6th character of the entity section (char at index 12) encodes entity number.
 * We don't have an official "SEZ" marker in GSTIN itself; SEZ must be flagged explicitly.
 */
export function inferRegistrationType(gstin: string): RegistrationType {
  // Character at position 5 (0-indexed) in the 10-char PAN segment indicates taxpayer type.
  // GSTIN[5] is the 6th character overall (0-indexed).
  // By convention: P=Individual, F=Firm, C=Company, H=HUF, A=AOP, B=BOI, G=Govt, J=AJP, L=LLP, T=Trust
  // None of these directly tell us COMPOSITION vs REGULAR from GSTIN alone.
  // The entity number at index 12 (1-9, A-Z) also doesn't encode composition.
  // Best we can infer: if it's a valid GSTIN → REGULAR.
  return RegistrationType.REGULAR;
}

// ─────────────────────────────────────────────────────────────────────────────
// GSTIN Checksum (Luhn-style mod-36 used by GSTN)
// ─────────────────────────────────────────────────────────────────────────────

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function verifyChecksum(gstin: string): boolean {
  const computed = computeCheckDigit(gstin.slice(0, 14));
  return computed === gstin[14];
}

export function computeCheckDigit(partial: string): string {
  let sum = 0;
  for (let i = 0; i < partial.length; i++) {
    const val = CHARS.indexOf(partial[i]);
    if (val === -1) return "";
    const product = val * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const remainder = sum % 36;
  return CHARS[(36 - remainder) % 36];
}

/**
 * Returns true if two GSTIN state codes are the same (intra-state).
 */
export function isSameState(stateA: string, stateB: string): boolean {
  return stateA.substring(0, 2) === stateB.substring(0, 2);
}

/**
 * Returns a user-friendly state name for a given state code.
 */
export function getStateName(code: string): string {
  const map: Record<string, string> = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "26": "Dadra & Nagar Haveli and Daman & Diu",
    "27": "Maharashtra",
    "28": "Andhra Pradesh (old)",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman & Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
    "96": "Other Territory",
    "97": "Other Country",
    "99": "Centre Jurisdiction",
  };
  return map[code] ?? `State ${code}`;
}

/** Well-known GSTIN prefixes for overseas/UIN parties */
export const OVERSEAS_STATE_CODES = new Set(["96", "97", "99"]);

export { StateCode };
