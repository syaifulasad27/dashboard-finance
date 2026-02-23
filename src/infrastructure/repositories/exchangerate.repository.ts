import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { ExchangeRateModel, IExchangeRate } from "@/infrastructure/database/models/ExchangeRate";

export class ExchangeRateRepository extends BaseRepository<IExchangeRate> {
  constructor() {
    super(ExchangeRateModel);
  }

  /**
   * Find latest rate for a currency pair
   */
  async findLatestRate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    asOfDate: Date = new Date(),
    session?: ClientSession
  ): Promise<IExchangeRate | null> {
    await this.ensureConnection();

    let query = ExchangeRateModel.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      fromCurrency,
      toCurrency,
      effectiveDate: { $lte: asOfDate },
    }).sort({ effectiveDate: -1 });

    if (session) query = query.session(session);

    return query.lean();
  }

  /**
   * Find all rates for a base currency
   */
  async findRatesForCurrency(
    companyId: string,
    baseCurrency: string,
    session?: ClientSession
  ): Promise<IExchangeRate[]> {
    return this.find(
      companyId,
      { fromCurrency: baseCurrency },
      { sort: { toCurrency: 1, effectiveDate: -1 }, session }
    );
  }

  /**
   * Get latest rates for all pairs
   */
  async getLatestRates(
    companyId: string,
    session?: ClientSession
  ): Promise<Array<{ fromCurrency: string; toCurrency: string; rate: number; effectiveDate: Date }>> {
    await this.ensureConnection();

    return ExchangeRateModel.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId) } },
      { $sort: { effectiveDate: -1 } },
      {
        $group: {
          _id: { from: "$fromCurrency", to: "$toCurrency" },
          rate: { $first: "$rate" },
          effectiveDate: { $first: "$effectiveDate" },
        },
      },
      {
        $project: {
          _id: 0,
          fromCurrency: "$_id.from",
          toCurrency: "$_id.to",
          rate: 1,
          effectiveDate: 1,
        },
      },
    ]).session(session || null);
  }

  /**
   * Get rate history for a currency pair
   */
  async getRateHistory(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    limit: number = 30,
    session?: ClientSession
  ): Promise<IExchangeRate[]> {
    return this.find(
      companyId,
      { fromCurrency, toCurrency },
      { sort: { effectiveDate: -1 }, limit, session }
    );
  }

  /**
   * Bulk insert rates
   */
  async bulkInsertRates(
    companyId: string,
    rates: Array<{
      fromCurrency: string;
      toCurrency: string;
      rate: number;
      effectiveDate: Date;
      source?: string;
    }>,
    createdBy: string,
    session?: ClientSession
  ): Promise<number> {
    await this.ensureConnection();

    const documents = rates.map(r => ({
      companyId: new mongoose.Types.ObjectId(companyId),
      ...r,
      createdBy: new mongoose.Types.ObjectId(createdBy),
    }));

    const result = await ExchangeRateModel.insertMany(documents, { session });
    return result.length;
  }
}

export const exchangeRateRepository = new ExchangeRateRepository();
