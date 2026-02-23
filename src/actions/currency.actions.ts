"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/page-session";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { ExchangeRateModel } from "@/infrastructure/database/models/ExchangeRate";
import { CurrencyService, SUPPORTED_CURRENCIES } from "@/core/services/currency.service";
import mongoose from "mongoose";

const CreateRateSchema = z.object({
  fromCurrency: z.string().length(3),
  toCurrency: z.string().length(3),
  rate: z.number().positive(),
  effectiveDate: z.coerce.date(),
  source: z.string().optional(),
});

export async function createExchangeRate(formData: FormData) {
  const session = await requireAuth();
  await requirePermission(session, "EXCHANGE_RATE", "CREATE");
  await connectToDatabase();

  const input = CreateRateSchema.parse({
    fromCurrency: formData.get("fromCurrency"),
    toCurrency: formData.get("toCurrency"),
    rate: parseFloat(formData.get("rate") as string),
    effectiveDate: formData.get("effectiveDate"),
    source: formData.get("source") || "MANUAL",
  });

  if (input.fromCurrency === input.toCurrency) {
    throw new Error("Source and target currency cannot be the same");
  }

  const exchangeRate = await ExchangeRateModel.create({
    companyId: new mongoose.Types.ObjectId(session.companyId),
    ...input,
    createdBy: new mongoose.Types.ObjectId(session.user.id),
  });

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "CREATE",
    module: "ExchangeRate",
    resourceId: exchangeRate._id.toString(),
    newValue: input,
  });

  revalidatePath("/settings/currency");
  return { success: true, id: exchangeRate._id.toString() };
}

export async function getExchangeRates() {
  const session = await requireAuth();
  await requirePermission(session, "EXCHANGE_RATE", "READ");
  await connectToDatabase();

  const rates = await ExchangeRateModel.find({
    companyId: new mongoose.Types.ObjectId(session.companyId),
  })
    .sort({ effectiveDate: -1, fromCurrency: 1 })
    .limit(100);

  return rates.map(r => ({
    id: r._id.toString(),
    fromCurrency: r.fromCurrency,
    toCurrency: r.toCurrency,
    rate: r.rate,
    effectiveDate: r.effectiveDate,
    source: r.source,
    createdAt: r.createdAt,
  }));
}

export async function getLatestRates() {
  const session = await requireAuth();
  await connectToDatabase();

  const rateMap = await CurrencyService.getLatestRates(session.companyId);
  
  const result: Array<{ pair: string; rate: number }> = [];
  rateMap.forEach((rate, pair) => {
    result.push({ pair, rate });
  });
  
  return result;
}

export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  asOfDate?: Date
) {
  const session = await requireAuth();
  await connectToDatabase();

  const result = await CurrencyService.convert(
    session.companyId,
    amount,
    fromCurrency,
    toCurrency,
    asOfDate || new Date()
  );

  if (!result) {
    throw new Error(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
  }

  return result;
}

export async function deleteExchangeRate(rateId: string) {
  const session = await requireAuth();
  await requirePermission(session, "EXCHANGE_RATE", "DELETE");
  await connectToDatabase();

  const rate = await ExchangeRateModel.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(rateId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
  });

  if (!rate) throw new Error("Exchange rate not found");

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "DELETE",
    module: "ExchangeRate",
    resourceId: rateId,
  });

  revalidatePath("/settings/currency");
  return { success: true };
}

export function getSupportedCurrencies() {
  return SUPPORTED_CURRENCIES;
}
