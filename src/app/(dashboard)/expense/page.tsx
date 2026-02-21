import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { ExpenseModel } from "@/infrastructure/database/models/Expense";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default async function ExpensePage() {
  await connectToDatabase();
  const companyId = "60d5ecb8b392d22b28f745d0"; // Mock session company

  const expenses = await ExpenseModel.find({ companyId }).sort({ date: -1 }).limit(50).lean();

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Expense Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses Records</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((exp: any) => (
                <TableRow key={exp._id.toString()}>
                  <TableCell>{format(new Date(exp.date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="font-medium">{exp.vendor}</TableCell>
                  <TableCell>{exp.category}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                      {exp.approvalStatus}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    Rp {parseFloat(exp.amount.toString()).toLocaleString("id-ID")}
                  </TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No expenses recorded yet.
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
