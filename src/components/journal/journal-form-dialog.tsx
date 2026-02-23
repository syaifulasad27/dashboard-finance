"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createManualJournal } from "@/actions/journal.actions";
import { getChartOfAccounts } from "@/actions/coa.actions";
import { Plus, Trash2, FileText } from "lucide-react";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface JournalLine {
  accountId: string;
  debit: string;
  credit: string;
}

export function JournalFormDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: "", debit: "", credit: "" },
    { accountId: "", debit: "", credit: "" },
  ]);

  useEffect(() => {
    if (open) {
      loadAccounts();
    }
  }, [open]);

  const loadAccounts = async () => {
    const result = await getChartOfAccounts();
    if (result.success) {
      setAccounts(result.accounts);
    }
  };

  const addLine = () => {
    setLines([...lines, { accountId: "", debit: "", credit: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof JournalLine, value: string) => {
    const newLines = [...lines];
    newLines[index][field] = value;
    setLines(newLines);
  };

  const calculateTotals = () => {
    const totalDebit = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
    return { totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  };

  const resetForm = () => {
    setDescription("");
    setDate(new Date().toISOString().split("T")[0]);
    setLines([
      { accountId: "", debit: "", credit: "" },
      { accountId: "", debit: "", credit: "" },
    ]);
  };

  const onSubmit = async () => {
    const { totalDebit, totalCredit, isBalanced } = calculateTotals();

    // Validate
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    if (!isBalanced) {
      toast.error(`Journal is not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`);
      return;
    }

    if (totalDebit === 0) {
      toast.error("Journal must have non-zero amounts");
      return;
    }

    // Filter out empty lines
    const validLines = lines.filter(
      (line) => line.accountId && (parseFloat(line.debit) > 0 || parseFloat(line.credit) > 0)
    );

    if (validLines.length < 2) {
      toast.error("At least 2 valid lines are required");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("description", description);
      formData.append("date", date);
      formData.append(
        "lines",
        JSON.stringify(
          validLines.map((line) => ({
            accountId: line.accountId,
            debit: parseFloat(line.debit) || 0,
            credit: parseFloat(line.credit) || 0,
          }))
        )
      );

      const result = await createManualJournal(formData);

      if (result.success) {
        toast.success("Journal entry created successfully");
        setOpen(false);
        resetForm();
      } else {
        toast.error(result.error || "An error occurred");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const { totalDebit, totalCredit, isBalanced } = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FileText className="mr-2 h-4 w-4" />
          New Journal Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Manual Journal Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                placeholder="Enter transaction description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Journal Lines</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-3 w-3" />
                Add Line
              </Button>
            </div>

            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                <div className="col-span-5">Account</div>
                <div className="col-span-3 text-right">Debit</div>
                <div className="col-span-3 text-right">Credit</div>
                <div className="col-span-1"></div>
              </div>

              {/* Lines */}
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Select
                      value={line.accountId}
                      onValueChange={(value) => updateLine(index, "accountId", value)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      placeholder="0"
                      className="h-9 text-sm text-right"
                      value={line.debit}
                      onChange={(e) => updateLine(index, "debit", e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      placeholder="0"
                      className="h-9 text-sm text-right"
                      value={line.credit}
                      onChange={(e) => updateLine(index, "credit", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 2}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Totals */}
              <div className="grid grid-cols-12 gap-2 pt-2 border-t">
                <div className="col-span-5 text-sm font-medium">Total</div>
                <div className="col-span-3 text-right font-mono text-sm font-medium">
                  {totalDebit.toLocaleString("id-ID")}
                </div>
                <div className="col-span-3 text-right font-mono text-sm font-medium">
                  {totalCredit.toLocaleString("id-ID")}
                </div>
                <div className="col-span-1"></div>
              </div>

              {/* Balance indicator */}
              <div className="text-center pt-2">
                {isBalanced && totalDebit > 0 ? (
                  <span className="text-sm text-green-600 font-medium">
                    ✓ Journal is balanced
                  </span>
                ) : totalDebit > 0 ? (
                  <span className="text-sm text-red-600 font-medium">
                    ✗ Out of balance by {Math.abs(totalDebit - totalCredit).toLocaleString("id-ID")}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Enter amounts to validate
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={loading || !isBalanced || totalDebit === 0}
          >
            {loading ? "Creating..." : "Create Journal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
