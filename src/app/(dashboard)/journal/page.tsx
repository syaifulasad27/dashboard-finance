import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { JournalRepository } from "@/infrastructure/repositories/journal.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default async function JournalPage() {
  await connectToDatabase();
  const companyId = "60d5ecb8b392d22b28f745d0"; // Mock session company

  const journals = await JournalRepository.getJournalsByCompany(companyId);

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">General Ledger & Journals</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Journal Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Journal No</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Lines</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {journals.map((journal: any) => (
                <TableRow key={journal._id.toString()}>
                  <TableCell>{format(new Date(journal.date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="font-medium">{journal.journalNo}</TableCell>
                  <TableCell>{journal.description}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {journal.source}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{journal.lines?.length || 0} items</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                      {journal.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {journals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No journal entries found. Simulate some transactions to see them here.
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
