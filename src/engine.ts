/**
 * engine.ts — Core GST treatment decision engine
 * Part of gst-engine | Developed by Business Swift | Made in India 🇮🇳
 *
 * @copyright 2026 Business Swift. All rights reserved.
 * See the LICENSE file for full terms.
 */

import {
  Address,
  CustomerInfo,
  GSTCategory,
  GSTEngineOptions,
  GSTTreatmentInput,
  GSTTreatmentResult,
  RegistrationType,
  SupplierInfo,
  SupplyNature,
  SupplyType,
  TaxType,
} from "./types";
import {
  getStateCodeFromGSTIN,
  isSameState,
  normaliseGSTIN,
  OVERSEAS_STATE_CODES,
} from "./gstin";

// ─────────────────────────────────────────────────────────────────────────────
// Thresholds (per GST Act / notifications)
// ─────────────────────────────────────────────────────────────────────────────

/** Inter-state B2C invoices above this value must be reported invoice-wise (B2C Large) */
const B2C_LARGE_THRESHOLD = 250_000; // ₹2.5 lakh
/** Suppliers above this turnover must generate IRN (e-invoice) */
const E_INVOICE_TURNOVER_THRESHOLD_CR = 5; // ₹5 crore
/** Goods movement above this value requires e-way bill */
const EWAY_BILL_VALUE_THRESHOLD = 50_000; // ₹50,000

// ─────────────────────────────────────────────────────────────────────────────
// Address helpers
// ─────────────────────────────────────────────────────────────────────────────

function isOverseasAddress(addr: Address): boolean {
  return (addr.countryCode ?? "IN").toUpperCase() !== "IN";
}

function getAddrStateCode(addr: Address): string | undefined {
  if (isOverseasAddress(addr)) return undefined;
  return addr.stateCode?.substring(0, 2);
}

function describeAddr(addr: Address): string {
  const parts: string[] = [];
  if (addr.city) parts.push(addr.city);
  if (addr.stateCode) parts.push(`state:${addr.stateCode}`);
  const cc = addr.countryCode ?? "IN";
  if (cc !== "IN") parts.push(cc);
  return parts.length ? parts.join(", ") : "unspecified";
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer classification helpers
// ─────────────────────────────────────────────────────────────────────────────

function isOverseasCustomer(c: CustomerInfo): boolean {
  if (c.registrationType === RegistrationType.OVERSEAS) return true;
  const shipping = c.shippingAddress ?? c.billingAddress;
  return isOverseasAddress(c.billingAddress) || isOverseasAddress(shipping);
}

function isSEZCustomer(c: CustomerInfo): boolean {
  return (
    c.registrationType === RegistrationType.SEZ_UNIT ||
    c.registrationType === RegistrationType.SEZ_DEVELOPER
  );
}

function isDeemedExporter(c: CustomerInfo): boolean {
  return c.registrationType === RegistrationType.DEEMED_EXPORTER;
}

function isRegisteredCustomer(c: CustomerInfo): boolean {
  if (c.gstin) return true;
  if (
    c.registrationType !== undefined &&
    c.registrationType !== RegistrationType.UNREGISTERED
  )
    return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Place of Supply resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves Place of Supply (PoS) and bill-to/ship-to flag.
 *
 * GST PoS rules applied:
 *   GOODS    → shipping address state (where goods are delivered)
 *   SERVICES → billing address state, or GSTIN-embedded state for registered customers
 *
 * Priority order:
 *   1. customer.placeOfSupplyStateCode (explicit override)
 *   2. GSTIN-embedded state code (services, registered customer only)
 *   3. shipping address stateCode (goods)
 *   4. billing address stateCode (services / fallback)
 */
function resolvePlaceOfSupply(
  customer: CustomerInfo,
  isGoods: boolean,
): {
  posStateCode: string | undefined;
  isBillToShipTo: boolean;
  posSource: GSTTreatmentResult["placeOfSupplySource"];
} {
  const effectiveShipping = customer.shippingAddress ?? customer.billingAddress;
  const billingState = getAddrStateCode(customer.billingAddress);
  const shippingState = getAddrStateCode(effectiveShipping);

  // Detect bill-to / ship-to
  const isBillToShipTo = !!(
    billingState &&
    shippingState &&
    !isSameState(billingState, shippingState)
  );

  // 1. Explicit override
  if (customer.placeOfSupplyStateCode) {
    return {
      posStateCode: customer.placeOfSupplyStateCode.substring(0, 2),
      isBillToShipTo,
      posSource: "override",
    };
  }

  // 2. For services with a registered customer → prefer GSTIN state
  if (!isGoods && customer.gstin) {
    const gstinState = getStateCodeFromGSTIN(customer.gstin);
    if (gstinState && !OVERSEAS_STATE_CODES.has(gstinState)) {
      return { posStateCode: gstinState, isBillToShipTo, posSource: "gstin" };
    }
  }

  // 3. Goods → shipping state
  if (isGoods) {
    return {
      posStateCode: shippingState,
      isBillToShipTo,
      posSource: "shipping",
    };
  }

  // 4. Services → billing state
  return { posStateCode: billingState, isBillToShipTo, posSource: "billing" };
}

function getSupplierStateCode(supplier: SupplierInfo): string | undefined {
  // 1. Extract from GSTIN (most authoritative)
  const normGstin = normaliseGSTIN(supplier.gstin);
  if (normGstin) return getStateCodeFromGSTIN(normGstin);

  // 2. Address stateCode fallback
  if (supplier.address) return getAddrStateCode(supplier.address);

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// E-invoice helper
// ─────────────────────────────────────────────────────────────────────────────

function resolveEInvoice(eligible: boolean, turnoverCr?: number): boolean {
  if (!eligible) return false;
  if (turnoverCr === undefined) return false;
  return turnoverCr >= E_INVOICE_TURNOVER_THRESHOLD_CR;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the complete GST treatment for a supplier → customer transaction.
 *
 * Inputs:
 *   supplier         – GSTIN (optional) + stateCode or address (required when GSTIN absent)
 *   customer         – GSTIN (optional) + billingAddress + shippingAddress (optional)
 *   invoice          – taxable value
 *   supplyNature     – TAXABLE (default) | NIL_RATED | EXEMPTED | NON_GST
 *   withPaymentOfTax – for SEZ/Export: whether IGST is paid (default: false)
 *
 * Options:
 *   isGoods          – true (default) → shipping drives PoS; false → billing drives PoS
 *   supplierTurnoverCr – used for e-invoice applicability
 *
 * Decision order:
 *   1. Non-taxable nature   → NIL_RATED / EXEMPTED / NON_GST
 *   2. Overseas customer    → EXPORT_WITH / WITHOUT_PAYMENT
 *   3. SEZ customer         → SEZ_WITH / WITHOUT_PAYMENT
 *   4. Deemed Exporter      → DEEMED_EXPORT
 *   5. Resolve PoS from billing / shipping / GSTIN
 *   6. Registered customer  → B2B (IGST or CGST+SGST)
 *   7. Unregistered:
 *        inter-state > ₹2.5L → B2C_LARGE
 *        otherwise            → B2C_SMALL
 */
export function getGSTTreatment(
  input: GSTTreatmentInput,
  options: GSTEngineOptions = {},
): GSTTreatmentResult {
  const { supplier, customer, invoice, withPaymentOfTax = false } = input;
  const supplyNature = input.supplyNature ?? SupplyNature.TAXABLE;
  const isGoods = options.isGoods ?? true;

  // ── Validate supplier state code availability ──────────────────────────────
  // GSTIN is optional, but when absent address.stateCode must be provided so
  // the engine can determine inter / intra-state supply type.
  const supplierGstinNorm = normaliseGSTIN(supplier.gstin);
  if (!supplierGstinNorm && !supplier.address?.stateCode) {
    throw new Error(
      "SupplierInfo: 'address.stateCode' is required when 'gstin' is not provided.",
    );
  }

  const supplierGstin = supplierGstinNorm;
  const customerGstin = normaliseGSTIN(customer.gstin);

  const shipping = customer.shippingAddress ?? customer.billingAddress;

  // ── 1. Non-taxable supply natures ─────────────────────────────────────────

  if (supplyNature === SupplyNature.NON_GST) {
    return base({
      category: GSTCategory.NON_GST,
      supplyType: SupplyType.INTRA_STATE,
      taxType: TaxType.NONE,
      posStateCode: undefined,
      isBillToShipTo: false,
      posSource: "none",
      rationale:
        "Supply is outside GST scope (e.g. petroleum, alcohol, electricity). No GST applicable.",
      eInvoiceApplicable: false,
      eWayBillRequired: false,
      supplierGstin,
      customerGstin,
    });
  }

  if (supplyNature === SupplyNature.NIL_RATED) {
    return base({
      category: GSTCategory.NIL_RATED,
      supplyType: SupplyType.INTRA_STATE,
      taxType: TaxType.NONE,
      posStateCode: undefined,
      isBillToShipTo: false,
      posSource: "none",
      rationale: "Supply is nil-rated (0% GST). No tax chargeable.",
      eInvoiceApplicable: false,
      eWayBillRequired: false,
      supplierGstin,
      customerGstin,
    });
  }

  if (supplyNature === SupplyNature.EXEMPTED) {
    return base({
      category: GSTCategory.EXEMPTED,
      supplyType: SupplyType.INTRA_STATE,
      taxType: TaxType.NONE,
      posStateCode: undefined,
      isBillToShipTo: false,
      posSource: "none",
      rationale: "Supply is exempt from GST. No tax chargeable.",
      eInvoiceApplicable: false,
      eWayBillRequired: false,
      supplierGstin,
      customerGstin,
    });
  }

  // ── 2. Export — overseas customer ─────────────────────────────────────────

  if (isOverseasCustomer(customer)) {
    const destCountry =
      shipping.countryCode ?? customer.billingAddress.countryCode ?? "overseas";

    return base({
      category: withPaymentOfTax
        ? GSTCategory.EXPORT_WITH_PAYMENT
        : GSTCategory.EXPORT_WITHOUT_PAYMENT,
      supplyType: SupplyType.INTER_STATE,
      taxType: withPaymentOfTax ? TaxType.IGST : TaxType.NONE,
      posStateCode: undefined,
      isBillToShipTo: false,
      posSource: "none",
      rationale: [
        withPaymentOfTax
          ? `Export to ${destCountry} with IGST payment (refund route).`
          : `Export to ${destCountry} under LUT/Bond — zero-rated, no IGST.`,
        `Billing: ${describeAddr(customer.billingAddress)}.`,
        `Shipping: ${describeAddr(shipping)}.`,
      ].join(" "),
      eInvoiceApplicable: false, // Exports exempt from e-invoice mandate
      eWayBillRequired: isGoods,
      supplierGstin,
      customerGstin,
    });
  }

  // ── 3. SEZ ────────────────────────────────────────────────────────────────

  if (isSEZCustomer(customer)) {
    const { posStateCode, isBillToShipTo, posSource } = resolvePlaceOfSupply(
      customer,
      isGoods,
    );
    const regType = customer.registrationType ?? RegistrationType.SEZ_UNIT;

    return base({
      category: withPaymentOfTax
        ? GSTCategory.SEZ_WITH_PAYMENT
        : GSTCategory.SEZ_WITHOUT_PAYMENT,
      supplyType: SupplyType.INTER_STATE, // SEZ always inter-state per GST law
      taxType: withPaymentOfTax ? TaxType.IGST : TaxType.NONE,
      posStateCode,
      isBillToShipTo,
      posSource,
      rationale: [
        withPaymentOfTax
          ? `Supply to ${regType} with IGST payment.`
          : `Supply to ${regType} without tax payment (LUT/bond — zero-rated).`,
        `PoS: ${posStateCode ?? "unknown"} (${posSource}).`,
        `Billing: ${describeAddr(customer.billingAddress)}.`,
        `Shipping: ${describeAddr(shipping)}.`,
        isBillToShipTo ? "[Bill-to/Ship-to transaction detected]" : "",
      ]
        .filter(Boolean)
        .join(" "),
      eInvoiceApplicable: resolveEInvoice(true, options.supplierTurnoverCr),
      eWayBillRequired: isGoods,
      supplierGstin,
      customerGstin,
    });
  }

  // ── 4. Deemed Export ──────────────────────────────────────────────────────

  if (isDeemedExporter(customer)) {
    const { posStateCode, isBillToShipTo, posSource } = resolvePlaceOfSupply(
      customer,
      isGoods,
    );

    return base({
      category: GSTCategory.DEEMED_EXPORT,
      supplyType: SupplyType.INTER_STATE,
      taxType: TaxType.IGST,
      posStateCode,
      isBillToShipTo,
      posSource,
      rationale: [
        `Deemed export to EOU/EPCG/AA holder (${customerGstin ?? "no GSTIN"}).`,
        "IGST charged; refund claim available to supplier or recipient.",
        `PoS: ${posStateCode ?? "unknown"} (${posSource}).`,
        `Billing: ${describeAddr(customer.billingAddress)}.`,
        `Shipping: ${describeAddr(shipping)}.`,
      ].join(" "),
      eInvoiceApplicable: resolveEInvoice(true, options.supplierTurnoverCr),
      eWayBillRequired:
        isGoods && invoice.taxableValue > EWAY_BILL_VALUE_THRESHOLD,
      supplierGstin,
      customerGstin,
    });
  }

  // ── 5. Resolve Place of Supply ────────────────────────────────────────────

  const { posStateCode, isBillToShipTo, posSource } = resolvePlaceOfSupply(
    customer,
    isGoods,
  );
  const supplierStateCode = getSupplierStateCode(supplier);

  const supplyType =
    !supplierStateCode || !posStateCode
      ? SupplyType.INTER_STATE // safe default when state codes unavailable
      : isSameState(supplierStateCode, posStateCode)
        ? SupplyType.INTRA_STATE
        : SupplyType.INTER_STATE;

  const taxType =
    supplyType === SupplyType.INTER_STATE ? TaxType.IGST : TaxType.CGST_SGST;

  const posRuleDesc = isGoods
    ? `shipping address (goods rule)`
    : posSource === "gstin"
      ? `customer GSTIN state (services rule)`
      : `billing address (services rule)`;

  const billShipNote = isBillToShipTo
    ? ` [Bill-to/Ship-to: billing→${getAddrStateCode(customer.billingAddress) ?? "?"}, shipping→${getAddrStateCode(shipping) ?? "?"}]`
    : "";

  const taxNote =
    taxType === TaxType.IGST ? "IGST applicable." : "CGST + SGST applicable.";

  // ── 6. Registered B2B ─────────────────────────────────────────────────────

  if (isRegisteredCustomer(customer)) {
    return base({
      category: GSTCategory.B2B,
      supplyType,
      taxType,
      posStateCode,
      isBillToShipTo,
      posSource,
      rationale: [
        `B2B supply to registered taxpayer (${customerGstin ?? "GSTIN not provided"}).`,
        `PoS: state ${posStateCode ?? "unknown"} — derived from ${posRuleDesc}.`,
        taxNote,
        billShipNote,
      ]
        .filter(Boolean)
        .join(" "),
      eInvoiceApplicable: resolveEInvoice(true, options.supplierTurnoverCr),
      eWayBillRequired:
        isGoods && invoice.taxableValue > EWAY_BILL_VALUE_THRESHOLD,
      supplierGstin,
      customerGstin,
    });
  }

  // ── 7. Unregistered — B2C ─────────────────────────────────────────────────

  const isInterState = supplyType === SupplyType.INTER_STATE;
  const isLarge = isInterState && invoice.taxableValue > B2C_LARGE_THRESHOLD;

  if (isLarge) {
    return base({
      category: GSTCategory.B2C_LARGE,
      supplyType,
      taxType: TaxType.IGST,
      posStateCode,
      isBillToShipTo,
      posSource,
      rationale: [
        `Inter-state B2C to unregistered customer.`,
        `Taxable value ₹${fmt(invoice.taxableValue)} exceeds ₹2,50,000 — B2C Large (invoice-wise GSTR-1 reporting).`,
        `PoS: state ${posStateCode ?? "unknown"} (${posRuleDesc}).`,
        billShipNote,
      ]
        .filter(Boolean)
        .join(" "),
      eInvoiceApplicable: false,
      eWayBillRequired:
        isGoods && invoice.taxableValue > EWAY_BILL_VALUE_THRESHOLD,
      supplierGstin,
      customerGstin: undefined,
    });
  }

  return base({
    category: GSTCategory.B2C_SMALL,
    supplyType,
    taxType,
    posStateCode,
    isBillToShipTo,
    posSource,
    rationale: isInterState
      ? [
          `Inter-state B2C to unregistered customer.`,
          `Value ₹${fmt(invoice.taxableValue)} ≤ ₹2,50,000 — B2C Small (consolidated GSTR-1).`,
          `PoS: state ${posStateCode ?? "unknown"} (${posRuleDesc}).`,
          billShipNote,
        ]
          .filter(Boolean)
          .join(" ")
      : [
          `Intra-state B2C to unregistered customer.`,
          `PoS: state ${posStateCode ?? "unknown"} (${posRuleDesc}).`,
          `CGST + SGST applicable. Consolidated GSTR-1 reporting.`,
        ].join(" "),
    eInvoiceApplicable: false,
    eWayBillRequired:
      isGoods && invoice.taxableValue > EWAY_BILL_VALUE_THRESHOLD,
    supplierGstin,
    customerGstin: undefined,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal result builder (maps internal param names to public interface)
// ─────────────────────────────────────────────────────────────────────────────

interface BuildParams {
  category: GSTCategory;
  supplyType: SupplyType;
  taxType: TaxType;
  posStateCode: string | undefined;
  isBillToShipTo: boolean;
  posSource: GSTTreatmentResult["placeOfSupplySource"];
  rationale: string;
  eInvoiceApplicable: boolean;
  eWayBillRequired: boolean;
  supplierGstin: string | undefined;
  customerGstin: string | undefined;
}

function base(p: BuildParams): GSTTreatmentResult {
  return {
    category: p.category,
    supplyType: p.supplyType,
    taxType: p.taxType,
    placeOfSupplyStateCode: p.posStateCode,
    isBillToShipTo: p.isBillToShipTo,
    placeOfSupplySource: p.posSource,
    rationale: p.rationale.trim(),
    eInvoiceApplicable: p.eInvoiceApplicable,
    eWayBillRequired: p.eWayBillRequired,
    supplierGstin: p.supplierGstin,
    customerGstin: p.customerGstin,
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}
