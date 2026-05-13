/**
 * gst-engine — Indian GST Computation & Treatment Engine
 * Developed by Business Swift | Made in India 🇮🇳
 *
 * Open-sourced as part of Business Swift's commitment to advancing India's
 * technology ecosystem and giving back to the developer community.
 *
 * @module gst-engine
 *
 * EXPORTS
 * -------
 * - GST treatment logic     → getGSTTreatment
 * - Tax computation         → computeTax, GST_RATE_SLABS
 * - GSTIN utilities         → isValidGSTIN, normaliseGSTIN, getStateCodeFromGSTIN, …
 * - Enumerations & types    → GSTCategory, SupplyType, TaxType, Address, …
 *
 * LICENSE
 * -------
 * Free to use for development and research.
 * Direct resale of this package or any modified version — with or without
 * monetary benefit — is strictly prohibited without written approval from
 * Business Swift.
 * Commercial licensing enquiries: legal@businessswift.in
 *
 * @copyright 2026 Business Swift. All rights reserved.
 * See the LICENSE file for full terms.
 */

export { getGSTTreatment } from "./engine";

export { computeTax, GST_RATE_SLABS } from "./tax";
export type { TaxBreakdown, TaxRate } from "./tax";

export {
  isValidGSTIN,
  isStructurallyValidGSTIN,
  normaliseGSTIN,
  getStateCodeFromGSTIN,
  inferRegistrationType,
  computeCheckDigit,
  isSameState,
  getStateName,
  OVERSEAS_STATE_CODES,
  StateCode,
} from "./gstin";

export {
  GSTCategory,
  SupplyType,
  TaxType,
  RegistrationType,
  SupplyNature,
} from "./types";

export type {
  Address,
  SupplierInfo,
  CustomerInfo,
  InvoiceValue,
  GSTTreatmentInput,
  GSTTreatmentResult,
  GSTEngineOptions,
} from "./types";
