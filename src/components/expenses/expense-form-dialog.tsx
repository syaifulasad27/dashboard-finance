"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { createExpense } from "@/actions/expense.actions";
import { Plus } from "lucide-react";

const expenseFormSchema = z.object({
  vendor: z.string().min(2, "Vendor name must be at least 2 characters"),
  category: z.string().min(1, "Category is required"),
  amount: z.string().min(1, "Amount is required"),
  tax: z.string().optional(),
  date: z.string().min(1, "Date is required"),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

const EXPENSE_CATEGORIES = [
  "Office Supplies",
  "Utilities",
  "Travel",
  "Equipment",
  "Marketing",
  "Professional Services",
  "Insurance",
  "Rent",
  "Maintenance",
  "Software & Subscriptions",
  "Meals & Entertainment",
  "Other",
];

interface ExpenseFormDialogProps {
  mode: "create";
  trigger?: React.ReactNode;
}

export function ExpenseFormDialog({ mode, trigger }: ExpenseFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      vendor: "",
      category: "",
      amount: "",
      tax: "0",
      date: new Date().toISOString().split("T")[0],
    },
  });

  const onSubmit = async (data: ExpenseFormData) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("vendor", data.vendor);
      formData.append("category", data.category);
      formData.append("amount", data.amount);
      formData.append("tax", data.tax || "0");
      formData.append("date", data.date);

      const result = await createExpense(formData);

      if (result.success) {
        toast.success("Expense recorded successfully");
        setOpen(false);
        form.reset();
      } else {
        toast.error(result.error || "An error occurred");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      Add Expense
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Record New Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="vendor">Vendor / Supplier *</Label>
              <Input
                id="vendor"
                placeholder="Enter vendor name"
                {...form.register("vendor")}
              />
              {form.formState.errors.vendor && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.vendor.message}
                </p>
              )}
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={form.watch("category")}
                onValueChange={(value) => form.setValue("category", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.category && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.category.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (IDR) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0"
                {...form.register("amount")}
              />
              {form.formState.errors.amount && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax">Tax (IDR)</Label>
              <Input
                id="tax"
                type="number"
                placeholder="0"
                {...form.register("tax")}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="date">Date *</Label>
              <Input id="date" type="date" {...form.register("date")} />
              {form.formState.errors.date && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.date.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Submit Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
