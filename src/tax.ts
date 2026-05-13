/**
 * tax.ts — GST rate slabs and tax computation
 * Part of gst-engine | Developed by Business Swift | Made in India 🇮🇳
 *
 * @copyright 2026 Business Swift. All rights reserved.
 * See the LICENSE file for full terms.
 */

import { TaxType } from "./types";

export interface TaxRate {
  cgst: number;
  sgst: number;
  igst: number;
  cess?: number;
}

export interface TaxBreakdown {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  grandTotal: number;
}

/**
 * Common GST rate slabs in India.
 * Cess rates are illustrative (e.g., luxury / sin goods).
 */
export const GST_RATE_SLABS: Record<string, TaxRate> = {
  "0": { cgst: 0, sgst: 0, igst: 0 },
  "0.1": { cgst: 0.05, sgst: 0.05, igst: 0.1 },
  "0.25": { cgst: 0.125, sgst: 0.125, igst: 0.25 },
  "1.5": { cgst: 0.75, sgst: 0.75, igst: 1.5 },
  "3": { cgst: 1.5, sgst: 1.5, igst: 3 },
  "5": { cgst: 2.5, sgst: 2.5, igst: 5 },
  "6": { cgst: 3, sgst: 3, igst: 6 },
  "12": { cgst: 6, sgst: 6, igst: 12 },
  "18": { cgst: 9, sgst: 9, igst: 18 },
  "28": { cgst: 14, sgst: 14, igst: 28 },
  "28+cess": { cgst: 14, sgst: 14, igst: 28, cess: 22 }, // e.g. large cars
};

/**
 * Computes the tax breakdown for a given taxable value, rate, and tax type.
 *
 * @param taxableValue  - Pre-tax invoice value in INR
 * @param gstRatePercent - GST rate as a percentage (e.g. 18 for 18%)
 * @param taxType        - CGST_SGST | IGST | NONE
 * @param cessRatePercent - Optional cess rate as a percentage
 */
export function computeTax(
  taxableValue: number,
  gstRatePercent: number,
  taxType: TaxType,
  cessRatePercent = 0,
): TaxBreakdown {
  if (taxType === TaxType.NONE) {
    return {
      taxableValue,
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
      totalTax: 0,
      grandTotal: taxableValue,
    };
  }

  const cess = round2((taxableValue * cessRatePercent) / 100);

  if (taxType === TaxType.IGST) {
    const igst = round2((taxableValue * gstRatePercent) / 100);
    return {
      taxableValue,
      cgst: 0,
      sgst: 0,
      igst,
      cess,
      totalTax: round2(igst + cess),
      grandTotal: round2(taxableValue + igst + cess),
    };
  }

  // CGST + SGST
  const halfRate = gstRatePercent / 2;
  const cgst = round2((taxableValue * halfRate) / 100);
  const sgst = round2((taxableValue * halfRate) / 100);
  return {
    taxableValue,
    cgst,
    sgst,
    igst: 0,
    cess,
    totalTax: round2(cgst + sgst + cess),
    grandTotal: round2(taxableValue + cgst + sgst + cess),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
