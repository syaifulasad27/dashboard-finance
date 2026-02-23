import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { expenseRepository } from "@/infrastructure/repositories/expense.repository";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { getPageSession } from "@/lib/page-session";
import { checkPermission } from "@/lib/permissions";
import { ExpenseActions } from "@/components/expenses/expense-actions";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";

export default async function ExpensePage() {
  const session = await getPageSession();
  await connectToDatabase();

  const expenses = await expenseRepository.getRecent(session.companyId, 50, 0);
  const pendingExpenses = await expenseRepository.findPendingApproval(session.companyId);
  const canCreate = checkPermission(session, "EXPENSE", "CREATE");
  const canApprove = checkPermission(session, "EXPENSE", "APPROVE");

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Expense Management</h1>
          {pendingExpenses.length > 0 && canApprove && (
            <p className="text-sm text-yellow-600 mt-1">
              {pendingExpenses.length} expense(s) pending approval
            </p>
          )}
        </div>
        {canCreate && (
          <ExpenseFormDialog mode="create" />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Records</CardTitle>
          <CardDescription>Track and manage company expenses with approval workflow.</CardDescription>
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
                {canApprove && <TableHead className="w-[80px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((exp: any) => (
                <TableRow key={exp._id.toString()}>
                  <TableCell>{format(new Date(exp.date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="font-medium">{exp.vendor}</TableCell>
                  <TableCell>{exp.category}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                      exp.approvalStatus === "APPROVED" 
                        ? "bg-green-50 text-green-700 ring-green-600/20"
                        : exp.approvalStatus === "REJECTED"
                        ? "bg-red-50 text-red-700 ring-red-600/20"
                        : exp.approvalStatus === "VOIDED"
                        ? "bg-gray-100 text-gray-600 ring-gray-500/20"
                        : "bg-yellow-50 text-yellow-800 ring-yellow-600/20"
                    }`}>
                      {exp.approvalStatus}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    Rp {parseFloat(exp.amount.toString()).toLocaleString("id-ID")}
                  </TableCell>
                  {canApprove && (
                    <TableCell>
                      <ExpenseActions
                        expense={{
                          _id: exp._id.toString(),
                          vendor: exp.vendor,
                          category: exp.category,
                          amount: exp.amount.toString(),
                          approvalStatus: exp.approvalStatus,
                        }}
                        canApprove={canApprove}
                        canVoid={canApprove}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canApprove ? 6 : 5} className="text-center py-8 text-muted-foreground">
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
