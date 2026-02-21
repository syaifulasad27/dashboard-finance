import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { RevenueModel } from "@/infrastructure/database/models/Revenue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default async function RevenuePage() {
  await connectToDatabase();
  const companyId = "60d5ecb8b392d22b28f745d0"; // Mock session company

  const revenues = await RevenueModel.find({ companyId }).sort({ date: -1 }).limit(50).lean();

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Revenue Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Income Records</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenues.map((rev: any) => (
                <TableRow key={rev._id.toString()}>
                  <TableCell>{format(new Date(rev.date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="font-medium">{rev.invoiceNumber}</TableCell>
                  <TableCell>{rev.customer}</TableCell>
                  <TableCell>{rev.source}</TableCell>
                  <TableCell>{rev.paymentMethod}</TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    Rp {parseFloat(rev.amount.toString()).toLocaleString("id-ID")}
                  </TableCell>
                </TableRow>
              ))}
              {revenues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
