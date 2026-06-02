# @business-swift/gst-engine

> A TypeScript-first GST (Goods & Services Tax) engine for India 🇮🇳.

Determines transaction category, supply type, applicable tax heads, e-invoice applicability, and e-way bill requirement for any supplier–customer pair — automatically resolving Place of Supply from **billing and shipping addresses**.

[![npm version](https://badge.fury.io/js/@business-swift%2Fgst-engine.svg)](https://badge.fury.io/js/@business-swift%2Fgst-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Made in India](https://img.shields.io/badge/Made%20in-India%20🇮🇳-orange.svg)](https://businessswift.in)

---

> **Developed by [Business Swift](https://businessswift.in)** — open-sourced as part of their broader vision to give back to society and push India forward in the field of technology.
>
> _"We believe that great developer tooling should be freely available to every developer, startup, and researcher. gst-engine is our contribution to that belief."_

---

## Features

- ✅ Full **GST Category** classification: B2B, B2C Small/Large, SEZ, Export, Deemed Export, Nil, Exempt, Non-GST
- ✅ Separate **billing and shipping address** inputs — Place of Supply resolved automatically
- ✅ **Bill-to / Ship-to** (triangular transaction) auto-detection
- ✅ **Goods vs Services** rule: shipping drives PoS for goods, billing for services
- ✅ **Inter-state vs Intra-state** from GSTIN or `address.stateCode` (GSTIN optional for supplier)
- ✅ **IGST / CGST+SGST / None** tax head determination
- ✅ **Overseas export** detection from address `countryCode`
- ✅ **GSTIN validation** (format + checksum)
- ✅ **Tax computation** with CGST, SGST, IGST, and Cess breakdown
- ✅ **E-invoice** applicability (₹5 Cr turnover threshold)
- ✅ **E-way bill** requirement check (₹50,000 goods threshold)
- ✅ Human-readable **rationale** for every decision (audit trails / UI tooltips)
- ✅ Zero runtime dependencies
- ✅ Full TypeScript types + JavaScript compatible

---

## Installation

```bash
npm install @business-swift/gst-engine
# or
yarn add @business-swift/gst-engine
```

---

## Quick Start

```typescript
import { getGSTTreatment } from "@business-swift/gst-engine";

const result = getGSTTreatment({
  supplier: {
    gstin: "27AAAPL1234C1Z5", // Maharashtra
  },
  customer: {
    gstin: "29BBBPL5678D1Z3", // Karnataka
    billingAddress: { stateCode: "29", city: "Bengaluru", countryCode: "IN" },
    shippingAddress: { stateCode: "29", city: "Bengaluru", countryCode: "IN" },
  },
  invoice: { taxableValue: 100_000 },
});

console.log(result.category); // "B2B"
console.log(result.supplyType); // "INTER_STATE"
console.log(result.taxType); // "IGST"
console.log(result.placeOfSupplyStateCode); // "29"
console.log(result.placeOfSupplySource); // "shipping"
console.log(result.isBillToShipTo); // false
console.log(result.rationale); // "B2B supply to registered taxpayer…"
```

---

## How Billing & Shipping Drive Taxation

The engine follows the GST Place of Supply (PoS) rules automatically:

| Supply type                    | `isGoods` | Place of Supply used                                     |
| ------------------------------ | --------- | -------------------------------------------------------- |
| Goods                          | `true`    | **Shipping address** state                               |
| Services                       | `false`   | **Billing address** state                                |
| Services (registered customer) | `false`   | **GSTIN-embedded state** (priority over billing address) |

The PoS state code is then compared to the **supplier's GSTIN state** to determine inter-state vs intra-state — and therefore IGST vs CGST+SGST.

### Bill-to / Ship-to (Triangular Transactions)

When `billingAddress.stateCode ≠ shippingAddress.stateCode`, the engine automatically sets `isBillToShipTo: true` and applies the correct PoS rule (shipping for goods, billing for services). No extra configuration needed.

### Overseas / Export Detection

If `billingAddress.countryCode` or `shippingAddress.countryCode` is any value other than `"IN"`, the supply is treated as an **export** — regardless of any GSTIN or registration type.

---

## API Reference

### `getGSTTreatment(input, options?)`

#### `GSTTreatmentInput`

| Field              | Type           | Required | Description                                    |
| ------------------ | -------------- | -------- | ---------------------------------------------- |
| `supplier`         | `SupplierInfo` | ✅       | Supplier GSTIN + optional address              |
| `customer`         | `CustomerInfo` | ✅       | Customer with billing & shipping addresses     |
| `invoice`          | `InvoiceValue` | ✅       | Taxable value                                  |
| `supplyNature`     | `SupplyNature` | ❌       | Default: `TAXABLE`                             |
| `withPaymentOfTax` | `boolean`      | ❌       | SEZ/Export: pay IGST upfront? Default: `false` |

---

#### `SupplierInfo`

| Field              | Type               | Required | Description                                                                                   |
| ------------------ | ------------------ | -------- | --------------------------------------------------------------------------------------------- |
| `gstin`            | `string?`          | ❌       | 15-char GSTIN. State code auto-extracted. Optional — see `address.stateCode` below.           |
| `registrationType` | `RegistrationType` | ❌       | Defaults to `REGULAR`                                                                         |
| `address`          | `Address`          | ⚠️       | `address.stateCode` is **required when `gstin` is absent** so inter/intra-state can be determined. |

> **Rule:** provide either `gstin` **or** `address.stateCode` (or both). The engine throws at runtime if neither is present.

---

#### `CustomerInfo`

| Field                    | Type                | Description                                                                |
| ------------------------ | ------------------- | -------------------------------------------------------------------------- |
| `gstin`                  | `string?`           | Present → B2B. Absent → B2C.                                               |
| `registrationType`       | `RegistrationType?` | Must be set for `SEZ_UNIT`, `SEZ_DEVELOPER`, `DEEMED_EXPORTER`, `OVERSEAS` |
| `billingAddress`         | `Address`           | **Required.** PoS for services.                                            |
| `shippingAddress`        | `Address?`          | PoS for goods. Falls back to `billingAddress` if omitted.                  |
| `placeOfSupplyStateCode` | `string?`           | Hard override for PoS state. Wins over all address logic.                  |

---

#### `Address`

| Field         | Type      | Description                                                           |
| ------------- | --------- | --------------------------------------------------------------------- |
| `line1`       | `string?` | Street / building                                                     |
| `line2`       | `string?` | Area / locality                                                       |
| `city`        | `string?` | City or town                                                          |
| `stateCode`   | `string?` | 2-digit Indian state code (e.g. `"27"` for Maharashtra)               |
| `pincode`     | `string?` | 6-digit PIN code                                                      |
| `countryCode` | `string?` | ISO 3166-1 alpha-2. Defaults to `"IN"`. Non-`"IN"` → overseas/export. |

---

#### `GSTEngineOptions`

| Field                | Type       | Description                                                        |
| -------------------- | ---------- | ------------------------------------------------------------------ |
| `supplierTurnoverCr` | `number?`  | Annual turnover in ₹ crores for e-invoice check (threshold: ₹5 Cr) |
| `isGoods`            | `boolean?` | `true` (default) = goods; `false` = services                       |

---

#### `GSTTreatmentResult`

| Field                    | Type                                                         | Description                    |
| ------------------------ | ------------------------------------------------------------ | ------------------------------ |
| `category`               | `GSTCategory`                                                | GST filing category            |
| `supplyType`             | `SupplyType`                                                 | `INTER_STATE` or `INTRA_STATE` |
| `taxType`                | `TaxType`                                                    | `IGST`, `CGST_SGST`, or `NONE` |
| `placeOfSupplyStateCode` | `string \| undefined`                                        | Resolved PoS state code        |
| `placeOfSupplySource`    | `"billing" \| "shipping" \| "gstin" \| "override" \| "none"` | What determined the PoS        |
| `isBillToShipTo`         | `boolean`                                                    | Billing state ≠ shipping state |
| `rationale`              | `string`                                                     | Human-readable explanation     |
| `eInvoiceApplicable`     | `boolean`                                                    | Is IRN generation mandatory?   |
| `eWayBillRequired`       | `boolean`                                                    | Is e-way bill required?        |
| `supplierGstin`          | `string \| undefined`                                        | Normalised supplier GSTIN      |
| `customerGstin`          | `string \| undefined`                                        | Normalised customer GSTIN      |

---

## Enums

### `GSTCategory`

| Value                    | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `B2B`                    | Supply to a registered taxpayer                             |
| `B2C_SMALL`              | Unregistered customer — intra-state, or inter-state ≤ ₹2.5L |
| `B2C_LARGE`              | Inter-state, unregistered, > ₹2.5L (invoice-wise GSTR-1)    |
| `SEZ_WITH_PAYMENT`       | SEZ supply with IGST                                        |
| `SEZ_WITHOUT_PAYMENT`    | SEZ supply zero-rated under LUT                             |
| `EXPORT_WITH_PAYMENT`    | Export with IGST payment                                    |
| `EXPORT_WITHOUT_PAYMENT` | Export zero-rated under LUT                                 |
| `DEEMED_EXPORT`          | Supply to EOU/EPCG/AA holder                                |
| `NIL_RATED`              | 0% GST by law                                               |
| `EXEMPTED`               | Exempt from GST                                             |
| `NON_GST`                | Outside GST scope (petroleum, alcohol, etc.)                |

### `RegistrationType`

| Value             | Description                  |
| ----------------- | ---------------------------- |
| `REGULAR`         | Regular GST taxpayer         |
| `COMPOSITION`     | Composition scheme           |
| `UNREGISTERED`    | No GST registration          |
| `SEZ_UNIT`        | SEZ unit                     |
| `SEZ_DEVELOPER`   | SEZ developer                |
| `DEEMED_EXPORTER` | EOU / EPCG / AA holder       |
| `OVERSEAS`        | Foreign / export customer    |
| `UIN`             | Unique Identification Number |

---

## Examples

### Standard B2B — goods, inter-state, bill-to/ship-to

```typescript
import { getGSTTreatment } from "@business-swift/gst-engine";

// Supplier in Maharashtra; customer billed in Karnataka but goods ship to Gujarat
const result = getGSTTreatment(
  {
    supplier: { gstin: "27AAAPL1234C1Z5" },
    customer: {
      gstin: "29BBBPL5678D1Z3",
      billingAddress: { stateCode: "29", city: "Bengaluru", countryCode: "IN" },
      shippingAddress: { stateCode: "24", city: "Surat", countryCode: "IN" },
    },
    invoice: { taxableValue: 80_000 },
  },
  { isGoods: true },
);

// category:               "B2B"
// supplyType:             "INTER_STATE"  (supplier=27, PoS=24)
// taxType:                "IGST"
// placeOfSupplyStateCode: "24"           (Gujarat — shipping address)
// placeOfSupplySource:    "shipping"
// isBillToShipTo:         true           (KA billing ≠ GJ shipping)
// eWayBillRequired:       true           (goods > ₹50,000)
```

### Services — PoS from customer GSTIN

```typescript
import { getGSTTreatment } from "@business-swift/gst-engine";

// Supplier MH, Customer has KA GSTIN, but billing/shipping addresses are both MH
const result = getGSTTreatment(
  {
    supplier: { gstin: "27AAAPL1234C1Z5" },
    customer: {
      gstin: "29BBBPL5678D1Z3", // KA
      billingAddress: { stateCode: "27" }, // MH (ignored for services with GSTIN)
      shippingAddress: { stateCode: "27" }, // MH (ignored for services)
    },
    invoice: { taxableValue: 50_000 },
  },
  { isGoods: false }, // ← services
);

// placeOfSupplySource: "gstin"   (KA from customer GSTIN)
// supplyType:          "INTER_STATE"
// taxType:             "IGST"
```

### Export — overseas shipping address

```typescript
const result = getGSTTreatment({
  supplier: { gstin: "27AAAPL1234C1Z5" },
  customer: {
    billingAddress: { stateCode: "27", countryCode: "IN" }, // domestic billing
    shippingAddress: { city: "Dubai", countryCode: "AE" }, // overseas delivery
  },
  invoice: { taxableValue: 500_000 },
  withPaymentOfTax: false,
});
// category: "EXPORT_WITHOUT_PAYMENT"
// taxType:  "NONE"
// eInvoiceApplicable: false
```

### Supplier without GSTIN — `address.stateCode` as fallback

When the supplier's GSTIN is not available (e.g. composition dealer or pre-registration scenario), pass `address.stateCode` instead:

```typescript
import { getGSTTreatment } from "@business-swift/gst-engine";

// Supplier in Maharashtra (no GSTIN), customer in Karnataka
const result = getGSTTreatment({
  supplier: {
    address: { stateCode: "27" }, // ← required when gstin is absent
  },
  customer: {
    gstin: "29BBBPL5678D1Z3",
    billingAddress: { stateCode: "29", city: "Bengaluru", countryCode: "IN" },
  },
  invoice: { taxableValue: 80_000 },
});
// category:       "B2B"
// supplyType:     "INTER_STATE"  (MH supplier ≠ KA customer)
// taxType:        "IGST"
// supplierGstin:  undefined      (none was provided)
```

> Omitting both `gstin` and `address.stateCode` throws:
> `SupplierInfo: 'address.stateCode' is required when 'gstin' is not provided.`

---

### SEZ — zero-rated (LUT), with e-invoice

```typescript
import { getGSTTreatment, RegistrationType } from "@business-swift/gst-engine";

const result = getGSTTreatment(
  {
    supplier: { gstin: "27AAAPL1234C1Z5" },
    customer: {
      gstin: "24DDDPL3456F1Z6",
      registrationType: RegistrationType.SEZ_UNIT,
      billingAddress: { stateCode: "24", countryCode: "IN" },
      shippingAddress: { stateCode: "24", countryCode: "IN" },
    },
    invoice: { taxableValue: 200_000 },
    withPaymentOfTax: false,
  },
  { supplierTurnoverCr: 10 }, // ≥ ₹5 Cr → e-invoice required
);
// category:            "SEZ_WITHOUT_PAYMENT"
// taxType:             "NONE"
// eInvoiceApplicable:  true
```

### Intra-state B2C — CGST + SGST

```typescript
const result = getGSTTreatment({
  supplier: { gstin: "27AAAPL1234C1Z5" },
  customer: {
    // No GSTIN → unregistered
    billingAddress: { stateCode: "27", city: "Pune", countryCode: "IN" },
  },
  invoice: { taxableValue: 15_000 },
});
// category:   "B2C_SMALL"
// supplyType: "INTRA_STATE"
// taxType:    "CGST_SGST"
```

---

## Tax Computation

```typescript
import { computeTax, TaxType } from "@business-swift/gst-engine";

// IGST @ 18%
const t = computeTax(100_000, 18, TaxType.IGST);
// { taxableValue: 100000, igst: 18000, cgst: 0, sgst: 0,
//   cess: 0, totalTax: 18000, grandTotal: 118000 }

// CGST + SGST @ 18%
const t2 = computeTax(100_000, 18, TaxType.CGST_SGST);
// { cgst: 9000, sgst: 9000, igst: 0, totalTax: 18000, grandTotal: 118000 }

// 28% + 22% Cess (luxury vehicles)
const t3 = computeTax(100_000, 28, TaxType.IGST, 22);
// { igst: 28000, cess: 22000, totalTax: 50000, grandTotal: 150000 }
```

---

## GSTIN Utilities

```typescript
import { isValidGSTIN, getStateCodeFromGSTIN, getStateName } from "@business-swift/gst-engine";

isValidGSTIN("29AABCU9603R1ZP"); // true/false (format + checksum)
getStateCodeFromGSTIN("27AAAPL1234C1Z5"); // "27"
getStateName("27"); // "Maharashtra"
getStateName("29"); // "Karnataka"
getStateName("07"); // "Delhi"
```

---

## Full Decision Tree

```
GSTTreatmentInput
       │
       ├─ supplyNature = NON_GST          → NON_GST        (no tax)
       ├─ supplyNature = NIL_RATED        → NIL_RATED       (no tax)
       ├─ supplyNature = EXEMPTED         → EXEMPTED        (no tax)
       │
       ├─ customer overseas?              ──────────────────────────────┐
       │    (countryCode ≠ "IN" on         withPaymentOfTax=true  → EXPORT_WITH_PAYMENT  (IGST)
       │     billing OR shipping)          withPaymentOfTax=false → EXPORT_WITHOUT_PAYMENT (none)
       │
       ├─ registrationType = SEZ_*        ──────────────────────────────┐
       │                                   withPaymentOfTax=true  → SEZ_WITH_PAYMENT    (IGST)
       │                                   withPaymentOfTax=false → SEZ_WITHOUT_PAYMENT (none)
       │                                   Always INTER_STATE
       │
       ├─ registrationType = DEEMED_EXPORTER → DEEMED_EXPORT (IGST, INTER_STATE)
       │
       ├─ Resolve Place of Supply ─────────────────────────────────────────────
       │    isGoods=true   → shippingAddress.stateCode
       │    isGoods=false  → customer GSTIN state (if registered), else billingAddress.stateCode
       │    placeOfSupplyStateCode set → use override (wins all)
       │
       │    supplierState == posState → INTRA_STATE → CGST+SGST
       │    supplierState != posState → INTER_STATE → IGST
       │
       ├─ customer registered (GSTIN)?
       │    yes → B2B
       │
       └─ customer unregistered
            INTER_STATE + value > ₹2,50,000 → B2C_LARGE
            otherwise                       → B2C_SMALL
```

---

## Legal Disclaimer

This package is provided for informational and development purposes only. GST rules, thresholds, and notifications are subject to change by the Government of India. Always consult a qualified CA or tax advisor and refer to the official [GSTN portal](https://www.gst.gov.in) for compliance decisions.

---

## About Business Swift

**gst-engine** has been developed by **Business Swift** as part of their internal project, and has been open-sourced as part of their broader and longer vision to give back to society and push **India forward in the field of technology**.

Business Swift believes that foundational developer tools — especially those tied to India's tax and compliance infrastructure — should be freely available to every Indian developer, startup, researcher, and student.

---

---

## HSN / SAC Search Engine

`@business-swift/gst-engine` includes a fully client-side, FlexSearch-powered HSN & SAC code lookup engine. It lazy-loads ~25,000 records on first use and provides sub-10ms typeahead in the browser.

### Installation

```bash
npm install @business-swift/gst-engine
```

### Quick start

```typescript
import { hydrate, search, getByCode, parseCode } from "@business-swift/gst-engine";

// Call once (e.g. on search-bar focus) — subsequent calls are instant
await hydrate();

// Typeahead — returns up to 10 matches
const results = await search("laptop");
console.log(results[0]);
// {
//   code: "8471",
//   type: "HSN",
//   name: "AUTOMATIC DATA PROCESSING MACHINES AND UNITS THEREOF",
//   currentRate: "18%",
//   rates: [{ pct: "18", desc: "...", from: "01/07/2017", isCurrent: true }],
//   chapter: { number: "84", name: "Nuclear reactors, boilers, machinery..." },
//   seo: { slug: "chapter-84-...", metaTitle: "GST Rate & HSN Code for...", ... },
//   matchedOn: "keywords",
//   updatedAt: "2025-08-19T16:17:32.749"
// }

// Exact lookup
const item = await getByCode("8471");

// Parse a code into its hierarchy
const h = parseCode("84713010");
// { level: 4, chapter: "84", heading: "8471", subheading: "847130", tariff: "84713010" }
```

### Search options

```typescript
// Filter by type
const sacResults = await search("software", { type: "SAC" });

// Filter by chapter
const oils = await search("oil", { chapter: "15", limit: 20 });

// Custom limit (max 50)
const top5 = await search("motor", { limit: 5 });
```

### Synchronous SEO helpers

These work without calling `hydrate()` and load only the 98-chapter metadata file (~20 KB):

```typescript
import { getChapterSeo, getChapterName } from "@business-swift/gst-engine";

const seo = getChapterSeo("84");
// { name: "Nuclear reactors...", slug: "chapter-84-...", metaTitle: "...", metaDescription: "..." }

const name = getChapterName("01");
// "Live Animals; Animal products"
```

### Next.js integration example

```tsx
// app/hsn-sac/page.tsx
"use client";
import { useState, useCallback } from "react";
import { hydrate, search, SearchResult } from "@business-swift/gst-engine";

let hydrated = false;

export default function HsnSearchPage() {
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleFocus = useCallback(async () => {
    if (!hydrated) {
      await hydrate();
      hydrated = true;
    }
  }, []);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value.trim();
    if (q.length < 2) { setResults([]); return; }
    setResults(await search(q, { limit: 10 }));
  }, []);

  return (
    <div>
      <input onFocus={handleFocus} onChange={handleChange} placeholder="Search HSN / SAC code…" />
      <ul>
        {results.map((r) => (
          <li key={r.code}>
            <a href={`/hsn-sac/${r.code}`}>
              <strong>{r.code}</strong> — {r.name} <em>({r.currentRate})</em>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### HSN API reference

| Function | Signature | Description |
|---|---|---|
| `hydrate` | `() => Promise<void>` | Lazy-loads index. Idempotent, concurrent-safe. |
| `search` | `(query, opts?) => Promise<SearchResult[]>` | Full-text typeahead. |
| `getByCode` | `(code) => Promise<SearchResult \| null>` | Exact code lookup. |
| `parseCode` | `(code) => CodeHierarchy` | Parses code into chapter/heading/subheading/tariff. |
| `getChapterSeo` | `(ch) => ChapterSeo \| null` | SEO metadata for a chapter. Synchronous. |
| `getChapterName` | `(ch) => string \| null` | Chapter name. Synchronous. |

#### `SearchOptions`

| Field | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `10` | Max results (capped at 50). |
| `type` | `"HSN" \| "SAC"` | — | Filter by code type. |
| `chapter` | `string` | — | 2-digit chapter filter, e.g. `"15"`. |

#### `SearchResult`

| Field | Type | Description |
|---|---|---|
| `code` | `string` | HSN / SAC code. |
| `type` | `"HSN" \| "SAC"` | Derived: ch `"99"` → SAC. |
| `name` | `string` | Short product name. |
| `currentRate` | `string` | Latest effective GST rate, e.g. `"18%"`. |
| `rates` | `Rate[]` | All historical + current rates, newest-first. |
| `chapter.number` | `string` | 2-digit chapter. |
| `chapter.name` | `string` | Chapter name. |
| `seo` | `ChapterSeo` | Chapter SEO metadata for detail pages. |
| `matchedOn` | `"code" \| "name" \| "keywords" \| "description"` | Which field produced the hit. |
| `updatedAt` | `string` | ISO date of last data update. |

---

## License

**MIT License** — Copyright (c) 2026 Business Swift. Made in India 🇮🇳

|     |                                                      |
| --- | ---------------------------------------------------- |
| ✅  | Use freely in any project — commercial or personal   |
| ✅  | Modify and build upon it                             |
| ✅  | Integrate into SaaS, apps, internal tooling          |
| ✅  | Distribute as part of a larger work                  |
| ❌  | Directly resell this package as a standalone product |

See the full [LICENSE](./LICENSE) file for complete terms.

---

_Developed by Business Swift | Made in India 🇮🇳_
