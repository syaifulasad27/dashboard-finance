"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { MoreHorizontal, Ban } from "lucide-react";
import { toast } from "sonner";
import { voidRevenue } from "@/actions/revenue.actions";

interface RevenueActionsProps {
  revenue: {
    _id: string;
    invoiceNumber: string;
    customer: string;
    source: string;
    amount: string;
    status?: string;
  };
  canVoid: boolean;
}

export function RevenueActions({ revenue, canVoid }: RevenueActionsProps) {
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleVoid = async () => {
    setIsLoading(true);
    try {
      const result = await voidRevenue(revenue._id, "Voided via UI");
      if (result.success) {
        toast.success("Revenue voided successfully");
        setShowVoidDialog(false);
      } else {
        toast.error(result.error || "Failed to void revenue");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const isVoided = revenue.status === "VOID";

  if (isVoided || !canVoid) {
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
          <DropdownMenuItem
            className="text-orange-600"
            onSelect={() => setShowVoidDialog(true)}
          >
            <Ban className="mr-2 h-4 w-4" />
            Void
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Revenue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void this revenue record?
              <br /><br />
              <strong>Invoice:</strong> {revenue.invoiceNumber}<br />
              <strong>Customer:</strong> {revenue.customer}<br />
              <strong>Source:</strong> {revenue.source}<br />
              <strong>Amount:</strong> Rp {parseFloat(revenue.amount).toLocaleString("id-ID")}
              <br /><br />
              This will create a reversing journal entry to offset the original transaction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoid}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? "Voiding..." : "Void Revenue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
