import Decimal from "decimal.js";

interface EmployeeTaxProfile {
  ptkpStatus: "TK/0" | "TK/1" | "K/0" | "K/1" | "K/2" | "K/3";
  grossSalary: number;
}

export class TaxEngine {
  static getPTKP(status: string): number {
    const ptkpMap: Record<string, number> = {
      "TK/0": 54000000,
      "TK/1": 58500000,
      "K/0": 58500000,
      "K/1": 63000000,
      "K/2": 67500000,
      "K/3": 72000000,
    };
    return ptkpMap[status] || 54000000;
  }

  static getTerCategory(status: string): "A" | "B" | "C" {
    if (["TK/0", "TK/1", "K/0"].includes(status)) return "A";
    if (["TK/2", "TK/3", "K/1", "K/2"].includes(status)) return "B";
    return "C";
  }

  static calculatePPh21TerMonthly(profile: EmployeeTaxProfile): number {
    const category = this.getTerCategory(profile.ptkpStatus);
    const gross = new Decimal(profile.grossSalary);
    let rate = new Decimal(0);

    // Simplified TER lookup tables logic (Requires full DPJ tables in real app)
    if (category === "A") {
      if (gross.lte(5400000)) rate = new Decimal(0);
      else if (gross.lte(5650000)) rate = new Decimal(0.25).div(100);
      else rate = new Decimal(0.5).div(100); // Exaggerated for sample
    }

    return gross.mul(rate).toNumber();
  }
}
