import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { revenueRepository } from "@/infrastructure/repositories/revenue.repository";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { getPageSession } from "@/lib/page-session";
import { checkPermission } from "@/lib/permissions";
import { RevenueFormDialog } from "@/components/revenue/revenue-form-dialog";
import { RevenueActions } from "@/components/revenue/revenue-actions";

export default async function RevenuePage() {
  const session = await getPageSession();
  await connectToDatabase();

  const revenues = await revenueRepository.getRecent(session.companyId, 50, 0);
  const canCreate = checkPermission(session, "REVENUE", "CREATE");
  const canVoid = checkPermission(session, "REVENUE", "APPROVE");

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Revenue Management</h1>
          <p className="text-muted-foreground mt-1">Track income and payments received.</p>
        </div>
        {canCreate && (
          <RevenueFormDialog mode="create" />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Income Records</CardTitle>
          <CardDescription>All recorded revenue transactions with journal entries.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {canVoid && <TableHead className="w-[80px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenues.map((rev: any) => (
                <TableRow key={rev._id.toString()}>
                  <TableCell>{format(new Date(rev.date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="font-medium">{rev.invoiceNumber}</TableCell>
                  <TableCell>{rev.customer}</TableCell>
                  <TableCell>{rev.source}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                      rev.status === "VOID"
                        ? "bg-gray-100 text-gray-600 ring-gray-500/20"
                        : rev.status === "PAID"
                        ? "bg-green-50 text-green-700 ring-green-600/20"
                        : "bg-yellow-50 text-yellow-700 ring-yellow-600/20"
                    }`}>
                      {rev.status || "ACTIVE"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    Rp {parseFloat(rev.amount.toString()).toLocaleString("id-ID")}
                  </TableCell>
                  {canVoid && (
                    <TableCell>
                      <RevenueActions
                        revenue={{
                          _id: rev._id.toString(),
                          invoiceNumber: rev.invoiceNumber,
                          customer: rev.customer,
                          source: rev.source,
                          amount: rev.amount.toString(),
                          status: rev.status,
                        }}
                        canVoid={canVoid}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {revenues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canVoid ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    No revenue recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
