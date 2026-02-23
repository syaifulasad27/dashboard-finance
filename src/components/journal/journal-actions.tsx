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
import { MoreHorizontal, RotateCcw, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { reverseJournal, voidJournal, postJournal } from "@/actions/journal.actions";

interface JournalActionsProps {
  journal: {
    _id: string;
    journalNo: string;
    description: string;
    status: "DRAFT" | "POSTED" | "VOID";
    totalDebit: number;
    totalCredit: number;
  };
  canApprove: boolean;
  canCreate: boolean;
}

export function JournalActions({ journal, canApprove, canCreate }: JournalActionsProps) {
  const [showReverseDialog, setShowReverseDialog] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleReverse = async () => {
    setIsLoading(true);
    try {
      const result = await reverseJournal(journal._id);
      if (result.success) {
        toast.success(`Reversing journal created successfully`);
        setShowReverseDialog(false);
      } else {
        toast.error(result.error || "Failed to reverse journal");
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
      const result = await voidJournal(journal._id);
      if (result.success) {
        toast.success("Journal voided successfully");
        setShowVoidDialog(false);
      } else {
        toast.error(result.error || "Failed to void journal");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePost = async () => {
    setIsLoading(true);
    try {
      const result = await postJournal(journal._id);
      if (result.success) {
        toast.success("Journal posted successfully");
        setShowPostDialog(false);
      } else {
        toast.error(result.error || "Failed to post journal");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const isDraft = journal.status === "DRAFT";
  const isPosted = journal.status === "POSTED";
  const isVoid = journal.status === "VOID";

  // No actions for voided journals
  if (isVoid) {
    return null;
  }

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
          {/* Draft journals can be posted */}
          {isDraft && canApprove && (
            <DropdownMenuItem
              className="text-green-600"
              onSelect={() => setShowPostDialog(true)}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Post Journal
            </DropdownMenuItem>
          )}

          {/* Posted journals can be reversed */}
          {isPosted && canCreate && (
            <DropdownMenuItem
              className="text-blue-600"
              onSelect={() => setShowReverseDialog(true)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Create Reversal
            </DropdownMenuItem>
          )}

          {/* Any non-void journal can be voided */}
          {!isVoid && canApprove && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-orange-600"
                onSelect={() => setShowVoidDialog(true)}
              >
                <Ban className="mr-2 h-4 w-4" />
                Void Journal
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Post Dialog */}
      <AlertDialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to post this journal entry?
              <br /><br />
              <strong>Journal No:</strong> {journal.journalNo}<br />
              <strong>Description:</strong> {journal.description}<br />
              <strong>Total:</strong> Rp {journal.totalDebit.toLocaleString("id-ID")}
              <br /><br />
              Once posted, this journal cannot be modified - only voided or reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePost}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? "Posting..." : "Post Journal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reverse Dialog */}
      <AlertDialog open={showReverseDialog} onOpenChange={setShowReverseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Reversing Entry</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new journal entry that reverses (offsets) the original entry.
              <br /><br />
              <strong>Original Journal:</strong> {journal.journalNo}<br />
              <strong>Description:</strong> {journal.description}<br />
              <strong>Amount:</strong> Rp {journal.totalDebit.toLocaleString("id-ID")}
              <br /><br />
              A new journal will be created with debits and credits swapped, dated today.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReverse}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? "Creating..." : "Create Reversal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Dialog */}
      <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void this journal entry?
              <br /><br />
              <strong>Journal No:</strong> {journal.journalNo}<br />
              <strong>Description:</strong> {journal.description}<br />
              <strong>Amount:</strong> Rp {journal.totalDebit.toLocaleString("id-ID")}
              <br /><br />
              <span className="text-orange-600 font-medium">
                Warning: Voiding does NOT create a reversing entry. The amounts will simply be excluded from reports. 
                For proper accounting, use "Create Reversal" instead.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoid}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? "Voiding..." : "Void Journal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
