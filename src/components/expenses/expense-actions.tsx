"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Check, X, Ban } from "lucide-react";
import { toast } from "sonner";
import { approveExpense, rejectExpense, voidExpense } from "@/actions/expense.actions";

interface ExpenseActionsProps {
  expense: {
    _id: string;
    vendor: string;
    category: string;
    amount: string;
    approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  };
  canApprove: boolean;
  canVoid: boolean;
}

export function ExpenseActions({ expense, canApprove, canVoid }: ExpenseActionsProps) {
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const result = await approveExpense(expense._id);
      if (result.success) {
        toast.success("Expense approved successfully");
        setShowApproveDialog(false);
      } else {
        toast.error(result.error || "Failed to approve expense");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      const result = await rejectExpense(expense._id);
      if (result.success) {
        toast.success("Expense rejected");
        setShowRejectDialog(false);
      } else {
        toast.error(result.error || "Failed to reject expense");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoid = async () => {
    setIsLoading(true);
    try {
      const result = await voidExpense(expense._id, "Voided via UI");
      if (result.success) {
        toast.success("Expense voided successfully");
        setShowVoidDialog(false);
      } else {
        toast.error(result.error || "Failed to void expense");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const isPending = expense.approvalStatus === "PENDING";
  const isApproved = expense.approvalStatus === "APPROVED";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canApprove && isPending && (
            <>
              <DropdownMenuItem
                className="text-green-600"
                onSelect={() => setShowApproveDialog(true)}
              >
                <Check className="mr-2 h-4 w-4" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onSelect={() => setShowRejectDialog(true)}
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </DropdownMenuItem>
            </>
          )}
          {canVoid && isApproved && (
            <>
              {canApprove && isPending && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className="text-orange-600"
                onSelect={() => setShowVoidDialog(true)}
              >
                <Ban className="mr-2 h-4 w-4" />
                Void
              </DropdownMenuItem>
            </>
          )}
          {!canApprove && !canVoid && (
            <DropdownMenuItem disabled>
              No actions available
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this expense?
              <br /><br />
              <strong>Vendor:</strong> {expense.vendor}<br />
              <strong>Category:</strong> {expense.category}<br />
              <strong>Amount:</strong> Rp {parseFloat(expense.amount).toLocaleString("id-ID")}
              <br /><br />
              This will create a journal entry and deduct from the bank account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this expense request?
              <br /><br />
              <strong>Vendor:</strong> {expense.vendor}<br />
              <strong>Category:</strong> {expense.category}<br />
              <strong>Amount:</strong> Rp {parseFloat(expense.amount).toLocaleString("id-ID")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Rejecting..." : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Dialog */}
      <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void this expense?
              <br /><br />
              <strong>Vendor:</strong> {expense.vendor}<br />
              <strong>Category:</strong> {expense.category}<br />
              <strong>Amount:</strong> Rp {parseFloat(expense.amount).toLocaleString("id-ID")}
              <br /><br />
              This will mark the expense as voided and create a reversing journal entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoid}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? "Voiding..." : "Void"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
