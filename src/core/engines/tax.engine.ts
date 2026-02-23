import Decimal from "decimal.js";

/**
 * TER (Tarif Efektif Rata-rata) PPh21 Tables based on PMK-168/2023
 * Category A: TK/0, TK/1, K/0
 * Category B: TK/2, TK/3, K/1, K/2
 * Category C: K/3
 */

interface TerBracket {
  minGross: number;
  maxGross: number;
  rate: number; // percentage as decimal (e.g., 0.5% = 0.005)
}

// TER Category A - TK/0, TK/1, K/0
const TER_CATEGORY_A: TerBracket[] = [
  { minGross: 0, maxGross: 5400000, rate: 0 },
  { minGross: 5400001, maxGross: 5650000, rate: 0.0025 },
  { minGross: 5650001, maxGross: 5950000, rate: 0.005 },
  { minGross: 5950001, maxGross: 6300000, rate: 0.0075 },
  { minGross: 6300001, maxGross: 6750000, rate: 0.01 },
  { minGross: 6750001, maxGross: 7500000, rate: 0.0125 },
  { minGross: 7500001, maxGross: 8550000, rate: 0.015 },
  { minGross: 8550001, maxGross: 9650000, rate: 0.0175 },
  { minGross: 9650001, maxGross: 10050000, rate: 0.02 },
  { minGross: 10050001, maxGross: 10350000, rate: 0.0225 },
  { minGross: 10350001, maxGross: 10700000, rate: 0.025 },
  { minGross: 10700001, maxGross: 11050000, rate: 0.03 },
  { minGross: 11050001, maxGross: 11600000, rate: 0.035 },
  { minGross: 11600001, maxGross: 12500000, rate: 0.04 },
  { minGross: 12500001, maxGross: 13750000, rate: 0.05 },
  { minGross: 13750001, maxGross: 15100000, rate: 0.06 },
  { minGross: 15100001, maxGross: 16950000, rate: 0.07 },
  { minGross: 16950001, maxGross: 19750000, rate: 0.08 },
  { minGross: 19750001, maxGross: 24150000, rate: 0.09 },
  { minGross: 24150001, maxGross: 26450000, rate: 0.10 },
  { minGross: 26450001, maxGross: 28000000, rate: 0.11 },
  { minGross: 28000001, maxGross: 30050000, rate: 0.12 },
  { minGross: 30050001, maxGross: 32400000, rate: 0.13 },
  { minGross: 32400001, maxGross: 35400000, rate: 0.14 },
  { minGross: 35400001, maxGross: 39100000, rate: 0.15 },
  { minGross: 39100001, maxGross: 43850000, rate: 0.16 },
  { minGross: 43850001, maxGross: 47800000, rate: 0.17 },
  { minGross: 47800001, maxGross: 51400000, rate: 0.18 },
  { minGross: 51400001, maxGross: 56300000, rate: 0.19 },
  { minGross: 56300001, maxGross: 62200000, rate: 0.20 },
  { minGross: 62200001, maxGross: 68600000, rate: 0.21 },
  { minGross: 68600001, maxGross: 77500000, rate: 0.22 },
  { minGross: 77500001, maxGross: 89000000, rate: 0.23 },
  { minGross: 89000001, maxGross: 103000000, rate: 0.24 },
  { minGross: 103000001, maxGross: 125000000, rate: 0.25 },
  { minGross: 125000001, maxGross: 157000000, rate: 0.26 },
  { minGross: 157000001, maxGross: 206000000, rate: 0.27 },
  { minGross: 206000001, maxGross: 337000000, rate: 0.28 },
  { minGross: 337000001, maxGross: 454000000, rate: 0.29 },
  { minGross: 454000001, maxGross: 550000000, rate: 0.30 },
  { minGross: 550000001, maxGross: 695000000, rate: 0.31 },
  { minGross: 695000001, maxGross: 910000000, rate: 0.32 },
  { minGross: 910000001, maxGross: 1400000000, rate: 0.33 },
  { minGross: 1400000001, maxGross: Infinity, rate: 0.34 },
];

// TER Category B - TK/2, TK/3, K/1, K/2
const TER_CATEGORY_B: TerBracket[] = [
  { minGross: 0, maxGross: 6200000, rate: 0 },
  { minGross: 6200001, maxGross: 6500000, rate: 0.0025 },
  { minGross: 6500001, maxGross: 6850000, rate: 0.005 },
  { minGross: 6850001, maxGross: 7300000, rate: 0.0075 },
  { minGross: 7300001, maxGross: 9200000, rate: 0.01 },
  { minGross: 9200001, maxGross: 10750000, rate: 0.015 },
  { minGross: 10750001, maxGross: 11250000, rate: 0.02 },
  { minGross: 11250001, maxGross: 11600000, rate: 0.025 },
  { minGross: 11600001, maxGross: 12600000, rate: 0.03 },
  { minGross: 12600001, maxGross: 13600000, rate: 0.04 },
  { minGross: 13600001, maxGross: 14950000, rate: 0.05 },
  { minGross: 14950001, maxGross: 16400000, rate: 0.06 },
  { minGross: 16400001, maxGross: 18450000, rate: 0.07 },
  { minGross: 18450001, maxGross: 21850000, rate: 0.08 },
  { minGross: 21850001, maxGross: 26000000, rate: 0.09 },
  { minGross: 26000001, maxGross: 27700000, rate: 0.10 },
  { minGross: 27700001, maxGross: 29350000, rate: 0.11 },
  { minGross: 29350001, maxGross: 31450000, rate: 0.12 },
  { minGross: 31450001, maxGross: 33950000, rate: 0.13 },
  { minGross: 33950001, maxGross: 37100000, rate: 0.14 },
  { minGross: 37100001, maxGross: 41100000, rate: 0.15 },
  { minGross: 41100001, maxGross: 45800000, rate: 0.16 },
  { minGross: 45800001, maxGross: 49500000, rate: 0.17 },
  { minGross: 49500001, maxGross: 53800000, rate: 0.18 },
  { minGross: 53800001, maxGross: 58500000, rate: 0.19 },
  { minGross: 58500001, maxGross: 64000000, rate: 0.20 },
  { minGross: 64000001, maxGross: 71000000, rate: 0.21 },
  { minGross: 71000001, maxGross: 80000000, rate: 0.22 },
  { minGross: 80000001, maxGross: 93000000, rate: 0.23 },
  { minGross: 93000001, maxGross: 109000000, rate: 0.24 },
  { minGross: 109000001, maxGross: 129000000, rate: 0.25 },
  { minGross: 129000001, maxGross: 163000000, rate: 0.26 },
  { minGross: 163000001, maxGross: 211000000, rate: 0.27 },
  { minGross: 211000001, maxGross: 374000000, rate: 0.28 },
  { minGross: 374000001, maxGross: 459000000, rate: 0.29 },
  { minGross: 459000001, maxGross: 555000000, rate: 0.30 },
  { minGross: 555000001, maxGross: 704000000, rate: 0.31 },
  { minGross: 704000001, maxGross: 957000000, rate: 0.32 },
  { minGross: 957000001, maxGross: 1405000000, rate: 0.33 },
  { minGross: 1405000001, maxGross: Infinity, rate: 0.34 },
];

// TER Category C - K/3
const TER_CATEGORY_C: TerBracket[] = [
  { minGross: 0, maxGross: 6600000, rate: 0 },
  { minGross: 6600001, maxGross: 6950000, rate: 0.0025 },
  { minGross: 6950001, maxGross: 7350000, rate: 0.005 },
  { minGross: 7350001, maxGross: 7800000, rate: 0.0075 },
  { minGross: 7800001, maxGross: 8850000, rate: 0.01 },
  { minGross: 8850001, maxGross: 9800000, rate: 0.0125 },
  { minGross: 9800001, maxGross: 10950000, rate: 0.015 },
  { minGross: 10950001, maxGross: 11200000, rate: 0.0175 },
  { minGross: 11200001, maxGross: 12050000, rate: 0.02 },
  { minGross: 12050001, maxGross: 12950000, rate: 0.03 },
  { minGross: 12950001, maxGross: 14150000, rate: 0.04 },
  { minGross: 14150001, maxGross: 15550000, rate: 0.05 },
  { minGross: 15550001, maxGross: 17050000, rate: 0.06 },
  { minGross: 17050001, maxGross: 19500000, rate: 0.07 },
  { minGross: 19500001, maxGross: 22700000, rate: 0.08 },
  { minGross: 22700001, maxGross: 26600000, rate: 0.09 },
  { minGross: 26600001, maxGross: 28100000, rate: 0.10 },
  { minGross: 28100001, maxGross: 30100000, rate: 0.11 },
  { minGross: 30100001, maxGross: 32600000, rate: 0.12 },
  { minGross: 32600001, maxGross: 35400000, rate: 0.13 },
  { minGross: 35400001, maxGross: 38900000, rate: 0.14 },
  { minGross: 38900001, maxGross: 43000000, rate: 0.15 },
  { minGross: 43000001, maxGross: 47400000, rate: 0.16 },
  { minGross: 47400001, maxGross: 51200000, rate: 0.17 },
  { minGross: 51200001, maxGross: 55800000, rate: 0.18 },
  { minGross: 55800001, maxGross: 60400000, rate: 0.19 },
  { minGross: 60400001, maxGross: 66700000, rate: 0.20 },
  { minGross: 66700001, maxGross: 74500000, rate: 0.21 },
  { minGross: 74500001, maxGross: 83200000, rate: 0.22 },
  { minGross: 83200001, maxGross: 95600000, rate: 0.23 },
  { minGross: 95600001, maxGross: 110000000, rate: 0.24 },
  { minGross: 110000001, maxGross: 134000000, rate: 0.25 },
  { minGross: 134000001, maxGross: 169000000, rate: 0.26 },
  { minGross: 169000001, maxGross: 221000000, rate: 0.27 },
  { minGross: 221000001, maxGross: 390000000, rate: 0.28 },
  { minGross: 390000001, maxGross: 463000000, rate: 0.29 },
  { minGross: 463000001, maxGross: 561000000, rate: 0.30 },
  { minGross: 561000001, maxGross: 709000000, rate: 0.31 },
  { minGross: 709000001, maxGross: 965000000, rate: 0.32 },
  { minGross: 965000001, maxGross: 1419000000, rate: 0.33 },
  { minGross: 1419000001, maxGross: Infinity, rate: 0.34 },
];

export class TaxEngine {
  /**
   * Get PTKP (Penghasilan Tidak Kena Pajak) based on status
   * Updated values for 2024
   */
  static getPTKP(status: string): number {
    const ptkpMap: Record<string, number> = {
      "TK/0": 54000000,
      "TK/1": 58500000,
      "TK/2": 63000000,
      "TK/3": 67500000,
      "K/0": 58500000,
      "K/1": 63000000,
      "K/2": 67500000,
      "K/3": 72000000,
    };
    return ptkpMap[status] || 54000000;
  }

  /**
   * Determine TER category based on PTKP status
   */
  static getTerCategory(status: string): "A" | "B" | "C" {
    if (["TK/0", "TK/1", "K/0"].includes(status)) return "A";
    if (["TK/2", "TK/3", "K/1", "K/2"].includes(status)) return "B";
    return "C";
  }

  /**
   * Get TER rate table by category
   */
  private static getTerTable(category: "A" | "B" | "C"): TerBracket[] {
    switch (category) {
      case "A": return TER_CATEGORY_A;
      case "B": return TER_CATEGORY_B;
      case "C": return TER_CATEGORY_C;
    }
  }

  /**
   * Find applicable TER rate for given gross salary
   */
  private static findTerRate(grossMonthly: number, category: "A" | "B" | "C"): number {
    const table = this.getTerTable(category);
    const bracket = table.find(b => grossMonthly >= b.minGross && grossMonthly <= b.maxGross);
    return bracket?.rate || 0;
  }

  /**
   * Calculate monthly PPh21 using TER method
   * This is the main method called by PayrollEngine
   * @param annualizedGross - The annualized gross salary (monthly * 12)
   * @param ptkpStatus - The PTKP status (TK/0, K/1, etc.)
   * @returns Monthly PPh21 amount
   */
  static calculateMonthlyPph21(annualizedGross: number, ptkpStatus: string): number {
    const monthlyGross = new Decimal(annualizedGross).div(12);
    const category = this.getTerCategory(ptkpStatus);
    const rate = this.findTerRate(monthlyGross.toNumber(), category);
    
    return monthlyGross.mul(rate).toDecimalPlaces(0).toNumber();
  }

  /**
   * Calculate annual PPh21 using progressive rates (for year-end adjustment)
   * @param annualIncome - Annual taxable income after deductions
   * @returns Annual PPh21 amount
   */
  static calculateAnnualPph21(annualIncome: number): number {
    const income = new Decimal(annualIncome);
    let tax = new Decimal(0);

    // Progressive tax brackets for Indonesia (2024)
    const brackets = [
      { limit: 60000000, rate: 0.05 },
      { limit: 250000000, rate: 0.15 },
      { limit: 500000000, rate: 0.25 },
      { limit: 5000000000, rate: 0.30 },
      { limit: Infinity, rate: 0.35 },
    ];

    let remainingIncome = income;
    let previousLimit = new Decimal(0);

    for (const bracket of brackets) {
      if (remainingIncome.lte(0)) break;

      const bracketLimit = new Decimal(bracket.limit);
      const bracketWidth = bracketLimit.minus(previousLimit);
      const taxableInBracket = Decimal.min(remainingIncome, bracketWidth);
      
      tax = tax.plus(taxableInBracket.mul(bracket.rate));
      remainingIncome = remainingIncome.minus(taxableInBracket);
      previousLimit = bracketLimit;
    }

    return tax.toDecimalPlaces(0).toNumber();
  }
}
