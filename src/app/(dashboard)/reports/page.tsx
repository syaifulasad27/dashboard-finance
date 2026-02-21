import { reportingRepository } from "@/infrastructure/repositories/reporting.repository";
import { ReportingEngine } from "@/core/engines/reporting.engine";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default async function ReportsPage() {
  await connectToDatabase();
  const companyId = "60d5ecb8b392d22b28f745d0";
  const today = new Date();

  const pl = await ReportingEngine.generateProfitAndLoss(companyId, new Date(today.getFullYear(), 0, 1), today);
  const bs = await ReportingEngine.generateBalanceSheet(companyId, today);

  return (
    <div className="p-8 space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold">Financial Reports</h1>
        <p className="text-muted-foreground mt-1">
          Detailed financial statements for PT Kukerja Indonesia.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PROFIT & LOSS */}
        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss (P&L)</CardTitle>
            <CardDescription>Fiscal year to date performance.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Revenue</h3>
                {pl.revenueItems.map(item => (
                  <div key={item.code} className="flex justify-between py-1 text-sm">
                    <span>{item.code} - {item.name}</span>
                    <span className="font-medium">Rp {item.balance.toLocaleString("id-ID")}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-bold text-base border-t mt-1">
                  <span>Total Revenue</span>
                  <span className="text-green-600">Rp {pl.revenue.toLocaleString("id-ID")}</span>
                </div>
              </div>

              <div className="pt-2">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Expenses</h3>
                {pl.expenseItems.map(item => (
                  <div key={item.code} className="flex justify-between py-1 text-sm">
                    <span>{item.code} - {item.name}</span>
                    <span className="font-medium text-red-600">(Rp {item.balance.toLocaleString("id-ID")})</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-bold text-base border-t mt-1">
                  <span>Total Expenses</span>
                  <span className="text-red-700">Rp {pl.expenses.toLocaleString("id-ID")}</span>
                </div>
              </div>

              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="py-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Net Profit</span>
                    <span className={`text-xl font-black ${pl.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      Rp {pl.netProfit.toLocaleString("id-ID")}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* BALANCE SHEET */}
        <Card>
          <CardHeader>
            <CardTitle>Balance Sheet</CardTitle>
            <CardDescription>Statement of financial position as of today.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="font-bold border-b pb-1 mb-2">Assets</h3>
                {bs.assets.map(a => (
                  <div key={a.code} className="flex justify-between text-sm py-1">
                    <span>{a.code} - {a.name}</span>
                    <span>Rp {a.balance.toLocaleString("id-ID")}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t font-bold">
                  <span>Total Assets</span>
                  <span>Rp {bs.totalAssets.toLocaleString("id-ID")}</span>
                </div>
              </div>

              <div>
                <h3 className="font-bold border-b pb-1 mb-2">Liabilities & Equity</h3>
                <div className="space-y-1">
                  {bs.liabilities.map(l => (
                    <div key={l.code} className="flex justify-between text-sm">
                      <span>{l.code} - {l.name}</span>
                      <span>Rp {l.balance.toLocaleString("id-ID")}</span>
                    </div>
                  ))}
                  {bs.equity.map(e => (
                    <div key={e.code} className="flex justify-between text-sm">
                      <span>{e.code} - {e.name}</span>
                      <span>Rp {e.balance.toLocaleString("id-ID")}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between pt-2 border-t font-bold">
                  <span>Total Liabilities & Equity</span>
                  <span>Rp {(bs.totalLiablities + bs.totalEquity).toLocaleString("id-ID")}</span>
                </div>
              </div>

              <div className={`p-3 rounded-lg flex justify-between items-center ${Math.abs(bs.totalAssets - (bs.totalLiablities + bs.totalEquity)) < 1 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                <span className="text-xs font-bold uppercase">Balance Status</span>
                <span className="text-sm font-black">
                  {Math.abs(bs.totalAssets - (bs.totalLiablities + bs.totalEquity)) < 1 ? "BALANCED" : "OUT OF BALANCE"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
