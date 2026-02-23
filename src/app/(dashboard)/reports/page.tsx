import { ReportingEngine } from "@/core/engines/reporting.engine";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPageSession } from "@/lib/page-session";
import { checkPermission } from "@/lib/permissions";
import { format } from "date-fns";

export default async function ReportsPage() {
  const session = await getPageSession();
  await connectToDatabase();

  // Check read permission for reports
  const canViewReports = checkPermission(session, "REPORT", "READ");
  if (!canViewReports) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You do not have permission to view reports.</p>
      </div>
    );
  }

  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const [ pl, bs, tb, cf ] = await Promise.all([
    ReportingEngine.generateProfitAndLoss(session.companyId, yearStart, today),
    ReportingEngine.generateBalanceSheet(session.companyId, today),
    ReportingEngine.generateTrialBalance(session.companyId, today),
    ReportingEngine.generateCashFlowStatement(session.companyId, yearStart, today)
  ]);

  return (
    <div className="p-8 space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold">Financial Reports</h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive financial statements as of {format(today, "dd MMMM yyyy")}.
        </p>
      </div>

      {/* Trial Balance - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle>Trial Balance</CardTitle>
          <CardDescription>Summary of all account balances as of {format(today, "dd MMM yyyy")}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tb.accounts.map((acc: any) => (
                <TableRow key={acc.code}>
                  <TableCell className="font-mono">{acc.code}</TableCell>
                  <TableCell>{acc.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                      acc.type === "Asset" ? "bg-blue-50 text-blue-700 ring-blue-600/20" :
                      acc.type === "Liability" ? "bg-orange-50 text-orange-700 ring-orange-600/20" :
                      acc.type === "Equity" ? "bg-purple-50 text-purple-700 ring-purple-600/20" :
                      acc.type === "Revenue" ? "bg-green-50 text-green-700 ring-green-600/20" :
                      "bg-red-50 text-red-700 ring-red-600/20"
                    }`}>
                      {acc.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {acc.debitBalance > 0 ? `Rp ${acc.debitBalance.toLocaleString("id-ID")}` : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {acc.creditBalance > 0 ? `Rp ${acc.creditBalance.toLocaleString("id-ID")}` : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {tb.accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No account balances found. Record some transactions to see the trial balance.
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="border-t-2 font-bold">
                <TableCell colSpan={3}>TOTAL</TableCell>
                <TableCell className="text-right font-mono">Rp {tb.totalDebit.toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-right font-mono">Rp {tb.totalCredit.toLocaleString("id-ID")}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className={`mt-4 p-3 rounded-lg flex justify-between items-center ${tb.isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            <span className="text-xs font-bold uppercase">Trial Balance Status</span>
            <span className="text-sm font-black">
              {tb.isBalanced ? "BALANCED" : `OUT OF BALANCE (Variance: Rp ${Math.abs(tb.variance).toLocaleString("id-ID")})`}
            </span>
          </div>
        </CardContent>
      </Card>

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
                {pl.revenueItems.map((item: any) => (
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
                {pl.expenseItems.map((item: any) => (
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
                {bs.assets.map((a: any) => (
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
                  {bs.liabilities.map((l: any) => (
                    <div key={l.code} className="flex justify-between text-sm">
                      <span>{l.code} - {l.name}</span>
                      <span>Rp {l.balance.toLocaleString("id-ID")}</span>
                    </div>
                  ))}
                  {bs.equity.map((e: any) => (
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

      {/* CASH FLOW STATEMENT */}
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow Statement</CardTitle>
          <CardDescription>
            Movement of cash from {format(yearStart, "dd MMM yyyy")} to {format(today, "dd MMM yyyy")}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Operating Activities */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm uppercase tracking-wider border-b pb-2">Operating Activities</h3>
              {cf.operating.items.length > 0 ? (
                cf.operating.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="truncate pr-2">{item.description}</span>
                    <span className={`font-mono ${item.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      Rp {item.amount.toLocaleString("id-ID")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No operating activities</p>
              )}
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Net Operating</span>
                <span className={cf.operating.total >= 0 ? "text-green-600" : "text-red-600"}>
                  Rp {cf.operating.total.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Investing Activities */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm uppercase tracking-wider border-b pb-2">Investing Activities</h3>
              {cf.investing.items.length > 0 ? (
                cf.investing.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="truncate pr-2">{item.description}</span>
                    <span className={`font-mono ${item.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      Rp {item.amount.toLocaleString("id-ID")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No investing activities</p>
              )}
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Net Investing</span>
                <span className={cf.investing.total >= 0 ? "text-green-600" : "text-red-600"}>
                  Rp {cf.investing.total.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Financing Activities */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm uppercase tracking-wider border-b pb-2">Financing Activities</h3>
              {cf.financing.items.length > 0 ? (
                cf.financing.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="truncate pr-2">{item.description}</span>
                    <span className={`font-mono ${item.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      Rp {item.amount.toLocaleString("id-ID")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No financing activities</p>
              )}
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Net Financing</span>
                <span className={cf.financing.total >= 0 ? "text-green-600" : "text-red-600"}>
                  Rp {cf.financing.total.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <Card className="bg-slate-50">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase">Opening Cash</p>
                <p className="text-xl font-bold">Rp {cf.openingBalance.toLocaleString("id-ID")}</p>
              </CardContent>
            </Card>
            <Card className={cf.netCashChange >= 0 ? "bg-green-50" : "bg-red-50"}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase">Net Change</p>
                <p className={`text-xl font-bold ${cf.netCashChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {cf.netCashChange >= 0 ? "+" : ""}Rp {cf.netCashChange.toLocaleString("id-ID")}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase">Closing Cash</p>
                <p className="text-xl font-bold">Rp {cf.closingBalance.toLocaleString("id-ID")}</p>
              </CardContent>
            </Card>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
