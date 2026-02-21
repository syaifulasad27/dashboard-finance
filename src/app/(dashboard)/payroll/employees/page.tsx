import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { EmployeeModel } from "@/infrastructure/database/models/Employee";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default async function EmployeePage() {
  await connectToDatabase();
  const companyId = "60d5ecb8b392d22b28f745d0"; // Mock session company

  const employees = await EmployeeModel.find({ companyId, isActive: true }).sort({ name: 1 }).lean();

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Employee Directory</h1>
          <p className="text-muted-foreground mt-1">Manage your workforce and salary configurations here.</p>
        </div>
        <Button>+ Add Employee</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Staff</CardTitle>
          <CardDescription>All employees currently enrolled in payroll.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NIK</TableHead>
                <TableHead>Employee Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead className="text-right">Basic Salary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp: any) => (
                <TableRow key={emp._id.toString()}>
                  <TableCell className="font-medium text-muted-foreground">{emp.nik}</TableCell>
                  <TableCell className="font-semibold">{emp.name}</TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20">
                      {emp.employmentStatus}
                    </span>
                  </TableCell>
                  <TableCell>{format(new Date(emp.joinDate), "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-right">
                    Rp {parseFloat(emp.salaryConfig?.basicSalary?.toString() || "0").toLocaleString("id-ID")}
                  </TableCell>
                </TableRow>
              ))}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No active employees found.
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
