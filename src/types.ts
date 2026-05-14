/**
 * types.ts — Public type definitions and enumerations for gst-engine
 * Part of gst-engine | Developed by Business Swift | Made in India 🇮🇳
 *
 * @copyright 2026 Business Swift. All rights reserved.
 * See the LICENSE file for full terms.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

/** GST supply / transaction category as reported in GSTR filings */
export enum GSTCategory {
  B2B = "B2B",
  B2C_SMALL = "B2C_SMALL",
  B2C_LARGE = "B2C_LARGE",
  SEZ_WITH_PAYMENT = "SEZ_WITH_PAYMENT",
  SEZ_WITHOUT_PAYMENT = "SEZ_WITHOUT_PAYMENT",
  EXPORT_WITH_PAYMENT = "EXPORT_WITH_PAYMENT",
  EXPORT_WITHOUT_PAYMENT = "EXPORT_WITHOUT_PAYMENT",
  DEEMED_EXPORT = "DEEMED_EXPORT",
  NIL_RATED = "NIL_RATED",
  EXEMPTED = "EXEMPTED",
  NON_GST = "NON_GST",
}

/** Whether the supply crosses state lines */
export enum SupplyType {
  INTER_STATE = "INTER_STATE",
  INTRA_STATE = "INTRA_STATE",
}

/** Which tax heads are chargeable on the invoice */
export enum TaxType {
  /** Central GST + State GST — intra-state supplies */
  CGST_SGST = "CGST_SGST",
  /** Integrated GST — inter-state, export (with tax), SEZ (with tax) */
  IGST = "IGST",
  /** No GST — nil-rated, exempt, non-GST, or zero-rated export/SEZ */
  NONE = "NONE",
}

/** GST registration category of a party */
export enum RegistrationType {
  REGULAR = "REGULAR",
  COMPOSITION = "COMPOSITION",
  UNREGISTERED = "UNREGISTERED",
  SEZ_UNIT = "SEZ_UNIT",
  SEZ_DEVELOPER = "SEZ_DEVELOPER",
  DEEMED_EXPORTER = "DEEMED_EXPORTER",
  OVERSEAS = "OVERSEAS",
  UIN = "UIN",
}

/** Taxability nature of the supply */
export enum SupplyNature {
  TAXABLE = "TAXABLE",
  NIL_RATED = "NIL_RATED",
  EXEMPTED = "EXEMPTED",
  NON_GST = "NON_GST",
}

export enum StateCode {
  JAMMU_KASHMIR = "01",
  HIMACHAL_PRADESH = "02",
  PUNJAB = "03",
  CHANDIGARH = "04",
  UTTARAKHAND = "05",
  HARYANA = "06",
  DELHI = "07",
  RAJASTHAN = "08",
  UTTAR_PRADESH = "09",
  BIHAR = "10",
  SIKKIM = "11",
  ARUNACHAL_PRADESH = "12",
  NAGALAND = "13",
  MANIPUR = "14",
  MIZORAM = "15",
  TRIPURA = "16",
  MEGHALAYA = "17",
  ASSAM = "18",
  WEST_BENGAL = "19",
  JHARKHAND = "20",
  ODISHA = "21",
  CHHATTISGARH = "22",
  MADHYA_PRADESH = "23",
  GUJARAT = "24",
  DADRA_NAGAR_HAVELI_DAMAN_DIU = "26",
  MAHARASHTRA = "27",
  ANDHRA_PRADESH_OLD = "28",
  KARNATAKA = "29",
  GOA = "30",
  LAKSHADWEEP = "31",
  KERALA = "32",
  TAMIL_NADU = "33",
  PUDUCHERRY = "34",
  ANDAMAN_NICOBAR = "35",
  TELANGANA = "36",
  ANDHRA_PRADESH = "37",
  LADAKH = "38",
}

// ─────────────────────────────────────────────────────────────────────────────
// Address
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A physical address used for billing or shipping.
 *
 * The engine uses addresses to determine:
 *   - Overseas status     (countryCode !== "IN")
 *   - Place of Supply     (stateCode)
 *   - Bill-to / Ship-to  (billing.stateCode !== shipping.stateCode)
 */
export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  /**
   * 2-digit Indian state/UT code (e.g. "27" for Maharashtra).
   * Required for domestic addresses when used in PoS determination.
   */
  stateCode?: string;
  pincode?: string;
  /**
   * ISO 3166-1 alpha-2 country code. Defaults to "IN".
   * Any value other than "IN" marks the address as overseas.
   */
  countryCode?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supplier
// ─────────────────────────────────────────────────────────────────────────────

export interface SupplierInfo {
  /**
   * 15-character GSTIN of the supplier.
   * Optional — if absent, `address.stateCode` **must** be provided
   * so the engine can determine inter/intra-state supply type.
   */
  gstin?: string;

  registrationType?: RegistrationType;

  /**
   * Supplier address.
   * `address.stateCode` is required when `gstin` is not supplied.
   */
  address?: Address;
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Customer with separate billing and shipping addresses.
 *
 * ## Place of Supply rules (auto-applied)
 *
 * | isGoods | PoS used               |
 * |---------|------------------------|
 * | true    | shippingAddress state  |
 * | false   | billingAddress state   |
 *
 * For registered customers (GSTIN present), the GSTIN-embedded state code
 * takes priority over billingAddress.stateCode for services.
 *
 * ## Bill-to / Ship-to (auto-detected)
 * When billingAddress.stateCode !== shippingAddress.stateCode the result
 * will have isBillToShipTo = true. The engine applies the correct PoS rule.
 *
 * ## Overseas export (auto-detected)
 * If billingAddress.countryCode or shippingAddress.countryCode is non-"IN",
 * the engine treats the supply as an export.
 *
 * ## SEZ / Deemed Export
 * Set registrationType explicitly — address state codes are irrelevant
 * for SEZ classification.
 */
export interface CustomerInfo {
  /** GSTIN → registered (B2B). Absent → unregistered (B2C). */
  gstin?: string;

  /**
   * Registration type. Auto-inferred as REGULAR when GSTIN is present.
   * Must be set explicitly for SEZ_UNIT, SEZ_DEVELOPER, DEEMED_EXPORTER, OVERSEAS.
   */
  registrationType?: RegistrationType;

  /**
   * Billing address — where the invoice is issued.
   * Place of Supply for services.
   * Doubles as shipping address when shippingAddress is omitted.
   */
  billingAddress: Address;

  /**
   * Shipping / delivery address — where goods physically move to.
   * Place of Supply for goods.
   * When omitted, billingAddress is used.
   */
  shippingAddress?: Address;

  /**
   * Explicit Place of Supply state code override.
   * Overrides all address-derived PoS calculations.
   * Use only when a specific statutory PoS rule applies.
   */
  placeOfSupplyStateCode?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice
// ─────────────────────────────────────────────────────────────────────────────

export interface InvoiceValue {
  /** Total taxable value before GST */
  taxableValue: number;
  /** ISO 4217 currency code — defaults to "INR" */
  currency?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main input
// ─────────────────────────────────────────────────────────────────────────────

export interface GSTTreatmentInput {
  supplier: SupplierInfo;
  customer: CustomerInfo;
  invoice: InvoiceValue;
  /** Defaults to TAXABLE */
  supplyNature?: SupplyNature;
  /**
   * For SEZ / Export supplies.
   * false (default) = zero-rated under LUT/bond.
   * true  = IGST paid upfront (refund route).
   */
  withPaymentOfTax?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Result
// ─────────────────────────────────────────────────────────────────────────────

export interface GSTTreatmentResult {
  category: GSTCategory;
  supplyType: SupplyType;
  taxType: TaxType;

  /** Resolved Place of Supply state code. undefined for export supplies. */
  placeOfSupplyStateCode: string | undefined;

  /** True when billing state !== shipping state (bill-to/ship-to). */
  isBillToShipTo: boolean;

  /** Which address/source determined the Place of Supply. */
  placeOfSupplySource: "billing" | "shipping" | "gstin" | "override" | "none";

  /** Human-readable explanation — suitable for audit trails and UI. */
  rationale: string;

  eInvoiceApplicable: boolean;
  eWayBillRequired: boolean;
  supplierGstin: string | undefined;
  customerGstin: string | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine options
// ─────────────────────────────────────────────────────────────────────────────

export interface GSTEngineOptions {
  /**
   * Supplier annual aggregate turnover in INR crores.
   * Used for e-invoice threshold check (₹5 Cr).
   */
  supplierTurnoverCr?: number;

  /**
   * true (default) = goods supply → shipping PoS, e-way bill applies.
   * false          = services supply → billing PoS, no e-way bill.
   */
  isGoods?: boolean;
}
