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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deactivateEmployee } from "@/actions/employee.actions";
import { EmployeeFormDialog } from "./employee-form-dialog";

interface EmployeeActionsProps {
  employee: {
    _id: string;
    nik: string;
    name: string;
    email: string;
    npwp?: string;
    bpjsNumber?: string;
    employmentStatus: "PERMANENT" | "CONTRACT" | "PROBATION";
    joinDate: Date | string;
    salaryConfig: {
      basicSalary: string;
      ptkpStatus: string;
    };
  };
  canUpdate: boolean;
  canDelete: boolean;
}

export function EmployeeActions({ employee, canUpdate, canDelete }: EmployeeActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deactivateEmployee(employee._id);
      if (result.success) {
        toast.success(`${employee.name} has been deactivated`);
        setShowDeleteDialog(false);
      } else {
        toast.error(result.error || "Failed to deactivate employee");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

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
          {canUpdate && (
            <EmployeeFormDialog
              mode="edit"
              employee={employee}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              }
            />
          )}
          {canUpdate && canDelete && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem
              className="text-red-600"
              onSelect={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Deactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <strong>{employee.name}</strong>?
              This employee will be removed from active payroll but their records will be retained.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deactivating..." : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
