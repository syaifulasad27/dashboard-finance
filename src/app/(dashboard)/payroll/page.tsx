import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { payrollRepository } from "@/infrastructure/repositories/payroll.repository";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { processPayrollBatch } from "@/actions/payroll.actions";
import { getPageSession } from "@/lib/page-session";
import { checkPermission } from "@/lib/permissions";

export default async function PayrollDashboard() {
  const session = await getPageSession();
  await connectToDatabase();

  const payrolls = await payrollRepository.getHistory(session.companyId);
  const canProcessPayroll = checkPermission(session, "PAYROLL", "CREATE");

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Server action for processing payroll
  const runPayrollAction = async () => {
    "use server";
    await processPayrollBatch(currentMonth, currentYear);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payroll Management</h1>
          <p className="text-muted-foreground mt-1">Review payroll history and run monthly salary batches.</p>
        </div>
        {canProcessPayroll && (
          <form action={runPayrollAction}>
            <Button variant="default" className="bg-indigo-600 hover:bg-indigo-700">
              Run {currentMonth}/{currentYear} Payroll
            </Button>
          </form>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll History</CardTitle>
          <CardDescription>Records of gross, tax, bpjs, and net payouts per period.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Run Date</TableHead>
                <TableHead className="text-right">Total Gross</TableHead>
                <TableHead className="text-right">Total BPJS</TableHead>
                <TableHead className="text-right">Total Tax</TableHead>
                <TableHead className="text-right">Total Net Paid</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrolls.map((pr: any) => (
                <TableRow key={pr._id.toString()}>
                  <TableCell className="font-semibold text-indigo-700">
                    {format(new Date(pr.periodYear, pr.periodMonth - 1, 1), "MMM yyyy")}
                  </TableCell>
                  <TableCell>{format(new Date(pr.createdAt), "dd MMM yy HH:mm")}</TableCell>
                  <TableCell className="text-right">
                    Rp {parseFloat(pr.totalGross.toString()).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    Rp {parseFloat(pr.totalBpjs.toString()).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    Rp {parseFloat(pr.totalTax.toString()).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-600">
                    Rp {parseFloat(pr.totalNett.toString()).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                      {pr.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {payrolls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No payrolls processed yet. Click "Run Payroll" to start.
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
