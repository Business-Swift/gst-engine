# Changelog

All notable changes to `@business-swift/gst-engine` are documented here.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] — 2026-09-18

### ⚠️ Breaking behaviour (shipped in a minor release)

**The same input can now return a different tax result.** If your supplier has
no GSTIN, or is registered under the composition scheme, `getGSTTreatment` now
returns `taxType: "NONE"` where earlier versions returned `IGST` or
`CGST_SGST`. Any invoice built from that result drops to zero tax.

This ships as a minor version, so a `^1.1.0` dependency range will pick it up
automatically. **Review your invoicing output after upgrading.** Pin to
`1.1.0` if you need the previous behaviour while you assess the change.

### Added

- Supplier entitlement check: a supplier who cannot legally collect GST now
  produces no tax on any taxable supply — B2B, B2C, export, SEZ and deemed
  export alike.

  | Supplier state                  | `category`              | `taxType` |
  | ------------------------------- | ----------------------- | --------- |
  | No `gstin`                      | `UNREGISTERED_SUPPLIER` | `NONE`    |
  | `registrationType: COMPOSITION` | `COMPOSITION`           | `NONE`    |

  Only a registered person may collect GST (CGST s.32(1)); a composition
  taxpayer pays out of pocket and issues a bill of supply, not a tax invoice
  (CGST s.10(4)).

- Two `GSTCategory` members: `UNREGISTERED_SUPPLIER` and `COMPOSITION`.
- README section "When the Supplier Cannot Charge GST", plus decision-tree and
  enum-table updates.

### Changed

- When the supplier cannot charge GST, `category` now reports *why* no tax
  applies rather than the supply kind. An unregistered supplier's B2B sale
  reports `UNREGISTERED_SUPPLIER`, not `B2B`; an export reports
  `UNREGISTERED_SUPPLIER`, not `EXPORT_WITHOUT_PAYMENT`.

  `supplyType`, `placeOfSupplyStateCode`, `customerGstin` and `rationale` are
  unaffected, so the supply details remain available.

- `NIL_RATED`, `EXEMPTED` and `NON_GST` supply natures keep their own
  category. They are equally untaxed and describe the supply itself, which is
  the more specific answer.

### Unchanged

- `computeTax` remains pure arithmetic and takes no supplier context. The
  guarantee holds through `getGSTTreatment`, whose `taxType: "NONE"` zeroes
  every head — including cess — at any rate. A caller who passes a rate and
  tax type directly, without consulting the engine, is unaffected.
- Place of supply, e-way bill and GSTR-1 reporting logic. These apply even
  when no tax does.

### Migration

Consumers exhaustively switching on `GSTCategory` must handle the two new
members:

```typescript
switch (result.category) {
  case GSTCategory.UNREGISTERED_SUPPLIER:
  case GSTCategory.COMPOSITION:
    // Bill of supply — no tax line items.
    break;
  // ... existing cases
}
```

TypeScript surfaces this at compile time only when the `switch` has no
`default` **and** the compiler can detect the gap — typically a function with
a declared non-`undefined` return type (`TS2366`), or an explicit
`assertNever(c)` in the default branch. A `switch` returning `void`, or one
with a `default`, compiles clean and changes behaviour silently, so check
those by hand.

Everyone else should confirm a zero-tax result renders correctly.

---

## [1.1.0]

- HSN/SAC code directory and search engine (`hydrate`, `search`, `getByCode`,
  `parseCode`), with SEO helpers (`getChapterSeo`, `getChapterName`).

## [1.0.2]

- `gstin` made optional on `SupplierInfo`; `address.stateCode` serves as the
  fallback for determining inter/intra-state supply.

## [1.0.1]

- Package renamed to `@business-swift/gst-engine` for the npm registry.

## [1.0.0]

- Initial release: GST treatment engine, tax computation, GSTIN utilities.
