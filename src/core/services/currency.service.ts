import mongoose from "mongoose";
import Decimal from "decimal.js";
import { ExchangeRateModel } from "@/infrastructure/database/models/ExchangeRate";

export const SUPPORTED_CURRENCIES = [
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]["code"];

export interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  rate: number;
  effectiveDate: Date;
}

export class CurrencyService {
  /**
   * Get exchange rate for a currency pair on a specific date
   * Returns the most recent rate on or before the given date
   */
  static async getRate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    asOfDate: Date = new Date()
  ): Promise<{ rate: number; effectiveDate: Date } | null> {
    // Same currency = rate of 1
    if (fromCurrency === toCurrency) {
      return { rate: 1, effectiveDate: asOfDate };
    }

    // Try direct rate
    const directRate = await ExchangeRateModel.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      fromCurrency,
      toCurrency,
      effectiveDate: { $lte: asOfDate },
    })
      .sort({ effectiveDate: -1 })
      .limit(1);

    if (directRate) {
      return { rate: directRate.rate, effectiveDate: directRate.effectiveDate };
    }

    // Try inverse rate
    const inverseRate = await ExchangeRateModel.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      fromCurrency: toCurrency,
      toCurrency: fromCurrency,
      effectiveDate: { $lte: asOfDate },
    })
      .sort({ effectiveDate: -1 })
      .limit(1);

    if (inverseRate) {
      return { 
        rate: new Decimal(1).div(inverseRate.rate).toNumber(), 
        effectiveDate: inverseRate.effectiveDate 
      };
    }

    // Try triangulation through base currency (USD)
    if (fromCurrency !== "USD" && toCurrency !== "USD") {
      const fromToUsd = await this.getRate(companyId, fromCurrency, "USD", asOfDate);
      const usdToTarget = await this.getRate(companyId, "USD", toCurrency, asOfDate);

      if (fromToUsd && usdToTarget) {
        return {
          rate: new Decimal(fromToUsd.rate).mul(usdToTarget.rate).toNumber(),
          effectiveDate: fromToUsd.effectiveDate < usdToTarget.effectiveDate 
            ? fromToUsd.effectiveDate 
            : usdToTarget.effectiveDate,
        };
      }
    }

    return null;
  }

  /**
   * Convert an amount from one currency to another
   */
  static async convert(
    companyId: string,
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    asOfDate: Date = new Date()
  ): Promise<ConversionResult | null> {
    const rateInfo = await this.getRate(companyId, fromCurrency, toCurrency, asOfDate);
    
    if (!rateInfo) {
      return null;
    }

    const convertedAmount = new Decimal(amount).mul(rateInfo.rate).toNumber();

    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount,
      targetCurrency: toCurrency,
      rate: rateInfo.rate,
      effectiveDate: rateInfo.effectiveDate,
    };
  }

  /**
   * Convert an amount to base currency (IDR)
   */
  static async convertToBase(
    companyId: string,
    amount: number,
    fromCurrency: string,
    asOfDate: Date = new Date()
  ): Promise<ConversionResult | null> {
    return this.convert(companyId, amount, fromCurrency, "IDR", asOfDate);
  }

  /**
   * Get all exchange rates for a company
   */
  static async getAllRates(companyId: string, asOfDate?: Date) {
    const query: Record<string, unknown> = {
      companyId: new mongoose.Types.ObjectId(companyId),
    };

    if (asOfDate) {
      query.effectiveDate = { $lte: asOfDate };
    }

    return ExchangeRateModel.find(query).sort({ effectiveDate: -1, fromCurrency: 1 });
  }

  /**
   * Get latest rates for all currency pairs
   */
  static async getLatestRates(companyId: string): Promise<Map<string, number>> {
    const rates = await ExchangeRateModel.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId) } },
      { $sort: { effectiveDate: -1 } },
      {
        $group: {
          _id: { from: "$fromCurrency", to: "$toCurrency" },
          rate: { $first: "$rate" },
          effectiveDate: { $first: "$effectiveDate" },
        },
      },
    ]);

    const rateMap = new Map<string, number>();
    for (const r of rates) {
      rateMap.set(`${r._id.from}-${r._id.to}`, r.rate);
    }
    return rateMap;
  }

  /**
   * Format currency amount for display
   */
  static format(amount: number, currencyCode: string, locale: string = "id-ID"): string {
    const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
    
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: currencyCode === "IDR" || currencyCode === "JPY" ? 0 : 2,
        maximumFractionDigits: currencyCode === "IDR" || currencyCode === "JPY" ? 0 : 2,
      }).format(amount);
    } catch {
      // Fallback for unsupported currencies
      return `${currency?.symbol || currencyCode} ${amount.toLocaleString(locale)}`;
    }
  }
}
