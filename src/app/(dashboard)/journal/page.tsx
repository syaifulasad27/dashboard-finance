import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { journalRepository } from "@/infrastructure/repositories/journal.repository";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { getPageSession } from "@/lib/page-session";
import { checkPermission } from "@/lib/permissions";
import { JournalActions } from "@/components/journal/journal-actions";
import { JournalFormDialog } from "@/components/journal/journal-form-dialog";

export default async function JournalPage() {
  const session = await getPageSession();
  await connectToDatabase();

  const journals = await journalRepository.getJournalsByCompany(session.companyId);
  const canCreate = checkPermission(session, "JOURNAL", "CREATE");
  const canApprove = checkPermission(session, "JOURNAL", "APPROVE");

  // Calculate totals for each journal
  const journalsWithTotals = journals.map((journal: any) => {
    const totalDebit = journal.lines?.reduce((sum: number, line: any) => {
      return sum + parseFloat(line.debit?.toString() || "0");
    }, 0) || 0;
    const totalCredit = journal.lines?.reduce((sum: number, line: any) => {
      return sum + parseFloat(line.credit?.toString() || "0");
    }, 0) || 0;
    return { ...journal, totalDebit, totalCredit };
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">General Ledger & Journals</h1>
          <p className="text-muted-foreground mt-1">View and manage all accounting entries.</p>
        </div>
        {canCreate && (
          <JournalFormDialog />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Journal Entries</CardTitle>
          <CardDescription>All financial transactions recorded as double-entry journals.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Journal No</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead>Status</TableHead>
                {(canCreate || canApprove) && <TableHead className="w-[80px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {journalsWithTotals.map((journal: any) => (
                <TableRow key={journal._id.toString()}>
                  <TableCell>{format(new Date(journal.date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="font-medium">{journal.journalNo}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{journal.description}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {journal.source}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    Rp {journal.totalDebit.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    Rp {journal.totalCredit.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${journal.status === "POSTED"
                        ? "bg-green-50 text-green-700 ring-green-600/20"
                        : journal.status === "VOID"
                          ? "bg-gray-100 text-gray-600 ring-gray-500/20"
                          : "bg-yellow-50 text-yellow-700 ring-yellow-600/20"
                      }`}>
                      {journal.status}
                    </span>
                  </TableCell>
                  {(canCreate || canApprove) && (
                    <TableCell>
                      <JournalActions
                        journal={{
                          _id: journal._id.toString(),
                          journalNo: journal.journalNo,
                          description: journal.description,
                          status: journal.status,
                          totalDebit: journal.totalDebit,
                          totalCredit: journal.totalCredit,
                        }}
                        canApprove={canApprove}
                        canCreate={canCreate}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {journals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={(canCreate || canApprove) ? 8 : 7} className="text-center py-8 text-muted-foreground">
                    No journal entries found. Create revenue or expense records to generate journals.
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
