/**
 * gst-engine — Developed by Business Swift | Made in India 🇮🇳
 * MIT License. Free to use. Direct resale as standalone is not permitted.
 * Copyright (c) 2026 Business Swift.
 */
/**
 * gst-engine
 *
 * Developed by Business Swift as part of their project and open-sourced as
 * part of their broader vision to give back to society and push India forward
 * in the field of technology.
 *
 * LICENSE RESTRICTIONS
 * --------------------
 * - May be used for development or research within India only.
 * - Direct selling of this package, or any modified version, for monetary
 *   benefit is strictly prohibited without written legal approval from
 *   Business Swift.
 * - For commercial licensing: legal@businessswift.in
 *
 * Copyright (c) 2026 Business Swift. All rights reserved.
 * See LICENSE file for full terms.
 */

import {
  getGSTTreatment,
  GSTCategory,
  SupplyType,
  TaxType,
  RegistrationType,
  SupplyNature,
  isValidGSTIN,
  getStateCodeFromGSTIN,
  computeTax,
} from "./index";
import { GSTTreatmentInput } from "./types";

// ─── helpers ──────────────────────────────────────────────────────────────────

const SUPPLIER_MH = { gstin: "27AAAPL1234C1Z5" }; // Maharashtra
const BILL_MH = { stateCode: "27", city: "Mumbai", countryCode: "IN" };
const BILL_KA = { stateCode: "29", city: "Bengaluru", countryCode: "IN" };
const BILL_GJ = { stateCode: "24", city: "Ahmedabad", countryCode: "IN" };
const BILL_US = { countryCode: "US", city: "New York" };

const INV_10K = { taxableValue: 10_000 };
const INV_60K = { taxableValue: 60_000 };
const INV_100K = { taxableValue: 100_000 };
const INV_300K = { taxableValue: 300_000 };

// ─── GSTIN utils ──────────────────────────────────────────────────────────────

describe("isValidGSTIN", () => {
  test("rejects empty string", () => expect(isValidGSTIN("")).toBe(false));
  test("rejects short string", () =>
    expect(isValidGSTIN("27AAAAA1234A1Z")).toBe(false));
  test("rejects invalid chars", () =>
    expect(isValidGSTIN("27AAAAA1234A1Z!X")).toBe(false));
  test("returns boolean for well-formed GSTIN", () =>
    expect(typeof isValidGSTIN("29AABCU9603R1ZP")).toBe("boolean"));
});

describe("getStateCodeFromGSTIN", () => {
  test.each([
    ["27AAAPL1234C1Z5", "27"],
    ["29BBBPL5678D1Z3", "29"],
    ["19CCCPL9012E1Z1", "19"],
  ])("%s → %s", (gstin, expected) =>
    expect(getStateCodeFromGSTIN(gstin)).toBe(expected),
  );
});

// ─── Non-taxable supply natures ───────────────────────────────────────────────

describe("supply nature overrides", () => {
  const base: GSTTreatmentInput = {
    supplier: SUPPLIER_MH,
    customer: { billingAddress: BILL_KA },
    invoice: INV_100K,
  };

  test("NON_GST → NON_GST, NONE tax", () => {
    const r = getGSTTreatment({ ...base, supplyNature: SupplyNature.NON_GST });
    expect(r.category).toBe(GSTCategory.NON_GST);
    expect(r.taxType).toBe(TaxType.NONE);
    expect(r.eInvoiceApplicable).toBe(false);
  });

  test("NIL_RATED → NIL_RATED, NONE tax", () => {
    const r = getGSTTreatment({
      ...base,
      supplyNature: SupplyNature.NIL_RATED,
    });
    expect(r.category).toBe(GSTCategory.NIL_RATED);
    expect(r.taxType).toBe(TaxType.NONE);
  });

  test("EXEMPTED → EXEMPTED, NONE tax", () => {
    const r = getGSTTreatment({ ...base, supplyNature: SupplyNature.EXEMPTED });
    expect(r.category).toBe(GSTCategory.EXEMPTED);
    expect(r.taxType).toBe(TaxType.NONE);
  });
});

// ─── Exports (overseas) ───────────────────────────────────────────────────────

describe("exports — overseas customer", () => {
  test("billing overseas → EXPORT_WITHOUT_PAYMENT (default)", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: { billingAddress: BILL_US },
      invoice: INV_100K,
    });
    expect(r.category).toBe(GSTCategory.EXPORT_WITHOUT_PAYMENT);
    expect(r.supplyType).toBe(SupplyType.INTER_STATE);
    expect(r.taxType).toBe(TaxType.NONE);
    expect(r.eInvoiceApplicable).toBe(false);
  });

  test("overseas shipping → EXPORT_WITHOUT_PAYMENT even if billing is domestic", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: {
        billingAddress: BILL_MH,
        shippingAddress: BILL_US,
      },
      invoice: INV_100K,
    });
    expect(r.category).toBe(GSTCategory.EXPORT_WITHOUT_PAYMENT);
  });

  test("with payment of tax → EXPORT_WITH_PAYMENT + IGST", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: { billingAddress: BILL_US },
      invoice: INV_100K,
      withPaymentOfTax: true,
    });
    expect(r.category).toBe(GSTCategory.EXPORT_WITH_PAYMENT);
    expect(r.taxType).toBe(TaxType.IGST);
  });

  test("registrationType OVERSEAS → export", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: {
        registrationType: RegistrationType.OVERSEAS,
        billingAddress: BILL_MH, // domestic address but OVERSEAS reg type
      },
      invoice: INV_100K,
    });
    expect(r.category).toBe(GSTCategory.EXPORT_WITHOUT_PAYMENT);
  });

  test("e-way bill required for goods export", () => {
    const r = getGSTTreatment(
      {
        supplier: SUPPLIER_MH,
        customer: { billingAddress: BILL_US },
        invoice: INV_100K,
      },
      { isGoods: true },
    );
    expect(r.eWayBillRequired).toBe(true);
  });

  test("e-way bill NOT required for services export", () => {
    const r = getGSTTreatment(
      {
        supplier: SUPPLIER_MH,
        customer: { billingAddress: BILL_US },
        invoice: INV_100K,
      },
      { isGoods: false },
    );
    expect(r.eWayBillRequired).toBe(false);
  });
});

// ─── SEZ ──────────────────────────────────────────────────────────────────────

describe("SEZ supply", () => {
  const sezCustomer = {
    gstin: "29BBBPL5678D1Z3",
    registrationType: RegistrationType.SEZ_UNIT,
    billingAddress: BILL_KA,
    shippingAddress: BILL_KA,
  };

  test("SEZ without payment → SEZ_WITHOUT_PAYMENT, INTER_STATE, NONE", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: sezCustomer,
      invoice: INV_100K,
      withPaymentOfTax: false,
    });
    expect(r.category).toBe(GSTCategory.SEZ_WITHOUT_PAYMENT);
    expect(r.supplyType).toBe(SupplyType.INTER_STATE);
    expect(r.taxType).toBe(TaxType.NONE);
  });

  test("SEZ with payment → SEZ_WITH_PAYMENT, IGST", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: sezCustomer,
      invoice: INV_100K,
      withPaymentOfTax: true,
    });
    expect(r.category).toBe(GSTCategory.SEZ_WITH_PAYMENT);
    expect(r.taxType).toBe(TaxType.IGST);
  });

  test("e-invoice required when turnover >= 5 Cr", () => {
    const r = getGSTTreatment(
      { supplier: SUPPLIER_MH, customer: sezCustomer, invoice: INV_100K },
      { supplierTurnoverCr: 10 },
    );
    expect(r.eInvoiceApplicable).toBe(true);
  });

  test("e-invoice NOT required when turnover < 5 Cr", () => {
    const r = getGSTTreatment(
      { supplier: SUPPLIER_MH, customer: sezCustomer, invoice: INV_100K },
      { supplierTurnoverCr: 3 },
    );
    expect(r.eInvoiceApplicable).toBe(false);
  });

  test("SEZ_DEVELOPER also triggers SEZ treatment", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: {
        registrationType: RegistrationType.SEZ_DEVELOPER,
        billingAddress: BILL_KA,
      },
      invoice: INV_100K,
    });
    expect(r.category).toBe(GSTCategory.SEZ_WITHOUT_PAYMENT);
  });
});

// ─── Deemed Export ────────────────────────────────────────────────────────────

describe("deemed export", () => {
  test("DEEMED_EXPORTER → DEEMED_EXPORT + IGST", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: {
        gstin: "29BBBPL5678D1Z3",
        registrationType: RegistrationType.DEEMED_EXPORTER,
        billingAddress: BILL_KA,
      },
      invoice: INV_100K,
    });
    expect(r.category).toBe(GSTCategory.DEEMED_EXPORT);
    expect(r.taxType).toBe(TaxType.IGST);
    expect(r.supplyType).toBe(SupplyType.INTER_STATE);
  });
});

// ─── B2B — Place of Supply from billing vs shipping ───────────────────────────

describe("B2B — inter-state vs intra-state", () => {
  test("goods: PoS = shipping state → IGST when shipping is inter-state", () => {
    // Supplier: MH, Billing: MH (same), Shipping: KA (different)
    const r = getGSTTreatment(
      {
        supplier: SUPPLIER_MH,
        customer: {
          gstin: "29BBBPL5678D1Z3",
          billingAddress: BILL_MH,
          shippingAddress: BILL_KA,
        },
        invoice: INV_100K,
      },
      { isGoods: true },
    );
    expect(r.category).toBe(GSTCategory.B2B);
    expect(r.supplyType).toBe(SupplyType.INTER_STATE);
    expect(r.taxType).toBe(TaxType.IGST);
    expect(r.placeOfSupplyStateCode).toBe("29"); // Karnataka (shipping)
    expect(r.placeOfSupplySource).toBe("shipping");
    expect(r.isBillToShipTo).toBe(true);
  });

  test("goods: PoS = shipping state → CGST+SGST when shipping is intra-state", () => {
    // Supplier: MH, Billing: KA (different), Shipping: MH (same as supplier)
    const r = getGSTTreatment(
      {
        supplier: SUPPLIER_MH,
        customer: {
          gstin: "27CCCPL9012E1Z8",
          billingAddress: BILL_KA,
          shippingAddress: BILL_MH,
        },
        invoice: INV_100K,
      },
      { isGoods: true },
    );
    expect(r.supplyType).toBe(SupplyType.INTRA_STATE);
    expect(r.taxType).toBe(TaxType.CGST_SGST);
    expect(r.placeOfSupplyStateCode).toBe("27"); // Maharashtra (shipping)
    expect(r.isBillToShipTo).toBe(true);
  });

  test("services: PoS = GSTIN state, ignores shipping", () => {
    // Supplier: MH, Customer GSTIN: KA, Shipping: MH
    const r = getGSTTreatment(
      {
        supplier: SUPPLIER_MH,
        customer: {
          gstin: "29BBBPL5678D1Z3", // KA GSTIN
          billingAddress: BILL_MH, // MH billing
          shippingAddress: BILL_MH, // MH shipping
        },
        invoice: INV_100K,
      },
      { isGoods: false },
    );
    expect(r.supplyType).toBe(SupplyType.INTER_STATE); // KA ≠ MH
    expect(r.placeOfSupplyStateCode).toBe("29"); // KA from GSTIN
    expect(r.placeOfSupplySource).toBe("gstin");
    expect(r.taxType).toBe(TaxType.IGST);
  });

  test("services: PoS = billing state when no GSTIN", () => {
    // Unregistered customer, billing KA, shipping MH
    const r = getGSTTreatment(
      {
        supplier: SUPPLIER_MH,
        customer: {
          billingAddress: BILL_KA,
          shippingAddress: BILL_MH,
        },
        invoice: INV_10K,
      },
      { isGoods: false },
    );
    expect(r.placeOfSupplyStateCode).toBe("29"); // KA (billing)
    expect(r.placeOfSupplySource).toBe("billing");
    expect(r.supplyType).toBe(SupplyType.INTER_STATE);
  });

  test("placeOfSupplyStateCode override wins over all", () => {
    // Supplier: MH, billing: MH, shipping: MH, but override GJ
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: {
        gstin: "27CCCPL9012E1Z8",
        billingAddress: BILL_MH,
        shippingAddress: BILL_MH,
        placeOfSupplyStateCode: "24", // Gujarat override
      },
      invoice: INV_100K,
    });
    expect(r.placeOfSupplyStateCode).toBe("24");
    expect(r.placeOfSupplySource).toBe("override");
    expect(r.supplyType).toBe(SupplyType.INTER_STATE); // GJ ≠ MH
  });

  test("standard intra-state B2B → CGST+SGST", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: { gstin: "27CCCPL9012E1Z8", billingAddress: BILL_MH },
      invoice: INV_100K,
    });
    expect(r.category).toBe(GSTCategory.B2B);
    expect(r.supplyType).toBe(SupplyType.INTRA_STATE);
    expect(r.taxType).toBe(TaxType.CGST_SGST);
    expect(r.isBillToShipTo).toBe(false);
  });

  test("standard inter-state B2B → IGST", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: { gstin: "29BBBPL5678D1Z3", billingAddress: BILL_KA },
      invoice: INV_100K,
    });
    expect(r.category).toBe(GSTCategory.B2B);
    expect(r.supplyType).toBe(SupplyType.INTER_STATE);
    expect(r.taxType).toBe(TaxType.IGST);
  });
});

// ─── E-way bill ───────────────────────────────────────────────────────────────

describe("e-way bill", () => {
  test("goods B2B > 50k → required", () => {
    const r = getGSTTreatment(
      {
        supplier: SUPPLIER_MH,
        customer: { gstin: "29BBBPL5678D1Z3", billingAddress: BILL_KA },
        invoice: INV_60K,
      },
      { isGoods: true },
    );
    expect(r.eWayBillRequired).toBe(true);
  });

  test("goods B2B ≤ 50k → not required", () => {
    const r = getGSTTreatment(
      {
        supplier: SUPPLIER_MH,
        customer: { gstin: "29BBBPL5678D1Z3", billingAddress: BILL_KA },
        invoice: INV_10K,
      },
      { isGoods: true },
    );
    expect(r.eWayBillRequired).toBe(false);
  });

  test("services → never required", () => {
    const r = getGSTTreatment(
      {
        supplier: SUPPLIER_MH,
        customer: { gstin: "29BBBPL5678D1Z3", billingAddress: BILL_KA },
        invoice: INV_300K,
      },
      { isGoods: false },
    );
    expect(r.eWayBillRequired).toBe(false);
  });
});

// ─── B2C ──────────────────────────────────────────────────────────────────────

describe("B2C", () => {
  test("intra-state unregistered → B2C_SMALL + CGST+SGST", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: { billingAddress: BILL_MH },
      invoice: INV_300K, // even large value → small because intra-state
    });
    expect(r.category).toBe(GSTCategory.B2C_SMALL);
    expect(r.taxType).toBe(TaxType.CGST_SGST);
  });

  test("inter-state unregistered ≤ 2.5L → B2C_SMALL + IGST", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: { billingAddress: BILL_KA },
      invoice: INV_100K,
    });
    expect(r.category).toBe(GSTCategory.B2C_SMALL);
    expect(r.taxType).toBe(TaxType.IGST);
  });

  test("inter-state unregistered > 2.5L → B2C_LARGE + IGST", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: { billingAddress: BILL_KA },
      invoice: INV_300K,
    });
    expect(r.category).toBe(GSTCategory.B2C_LARGE);
    expect(r.taxType).toBe(TaxType.IGST);
    expect(r.customerGstin).toBeUndefined();
  });

  test("goods B2C: PoS = shipping state", () => {
    // Billing: MH (intra), Shipping: KA (inter) → B2C_SMALL + IGST
    const r = getGSTTreatment(
      {
        supplier: SUPPLIER_MH,
        customer: {
          billingAddress: BILL_MH,
          shippingAddress: BILL_KA,
        },
        invoice: INV_100K,
      },
      { isGoods: true },
    );
    expect(r.supplyType).toBe(SupplyType.INTER_STATE);
    expect(r.placeOfSupplyStateCode).toBe("29"); // KA shipping
    expect(r.isBillToShipTo).toBe(true);
    expect(r.taxType).toBe(TaxType.IGST);
  });

  test("services B2C: PoS = billing state", () => {
    // Billing: KA (inter), Shipping: MH (intra) → PoS = KA
    const r = getGSTTreatment(
      {
        supplier: SUPPLIER_MH,
        customer: {
          billingAddress: BILL_KA,
          shippingAddress: BILL_MH,
        },
        invoice: INV_10K,
      },
      { isGoods: false },
    );
    expect(r.supplyType).toBe(SupplyType.INTER_STATE);
    expect(r.placeOfSupplyStateCode).toBe("29"); // KA billing
    expect(r.placeOfSupplySource).toBe("billing");
  });
});

// ─── Bill-to / Ship-to ────────────────────────────────────────────────────────

describe("bill-to / ship-to detection", () => {
  test("same state billing & shipping → isBillToShipTo false", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: {
        gstin: "29BBBPL5678D1Z3",
        billingAddress: BILL_KA,
        shippingAddress: BILL_KA,
      },
      invoice: INV_100K,
    });
    expect(r.isBillToShipTo).toBe(false);
  });

  test("different state billing & shipping → isBillToShipTo true", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: {
        gstin: "29BBBPL5678D1Z3",
        billingAddress: BILL_KA,
        shippingAddress: BILL_GJ,
      },
      invoice: INV_100K,
    });
    expect(r.isBillToShipTo).toBe(true);
  });

  test("no shippingAddress → isBillToShipTo false (billing used for both)", () => {
    const r = getGSTTreatment({
      supplier: SUPPLIER_MH,
      customer: { gstin: "29BBBPL5678D1Z3", billingAddress: BILL_KA },
      invoice: INV_100K,
    });
    expect(r.isBillToShipTo).toBe(false);
  });
});

// ─── Tax computation ──────────────────────────────────────────────────────────

describe("computeTax", () => {
  test("18% IGST on 1,00,000", () => {
    const t = computeTax(100_000, 18, TaxType.IGST);
    expect(t.igst).toBe(18_000);
    expect(t.cgst).toBe(0);
    expect(t.grandTotal).toBe(118_000);
  });

  test("18% CGST+SGST on 1,00,000", () => {
    const t = computeTax(100_000, 18, TaxType.CGST_SGST);
    expect(t.cgst).toBe(9_000);
    expect(t.sgst).toBe(9_000);
    expect(t.igst).toBe(0);
    expect(t.grandTotal).toBe(118_000);
  });

  test("NONE → zero tax, same grand total", () => {
    const t = computeTax(50_000, 18, TaxType.NONE);
    expect(t.totalTax).toBe(0);
    expect(t.grandTotal).toBe(50_000);
  });

  test("28% + 22% cess (luxury goods)", () => {
    const t = computeTax(100_000, 28, TaxType.IGST, 22);
    expect(t.igst).toBe(28_000);
    expect(t.cess).toBe(22_000);
    expect(t.totalTax).toBe(50_000);
    expect(t.grandTotal).toBe(150_000);
  });
});
