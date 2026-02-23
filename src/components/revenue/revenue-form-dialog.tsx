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
import { createRevenue } from "@/actions/revenue.actions";
import { Plus } from "lucide-react";

const revenueFormSchema = z.object({
  source: z.string().min(2, "Source must be at least 2 characters"),
  customer: z.string().min(2, "Customer name must be at least 2 characters"),
  invoiceNumber: z.string().min(2, "Invoice number is required"),
  amount: z.string().min(1, "Amount is required"),
  tax: z.string().optional(),
  paymentMethod: z.enum(["BANK_TRANSFER", "CASH", "CREDIT_CARD"]),
  date: z.string().min(1, "Date is required"),
});

type RevenueFormData = z.infer<typeof revenueFormSchema>;

const REVENUE_SOURCES = [
  "Product Sales",
  "Service Revenue",
  "Consulting",
  "Subscription",
  "Commission",
  "Interest Income",
  "Rental Income",
  "Other",
];

interface RevenueFormDialogProps {
  mode: "create";
  trigger?: React.ReactNode;
}

export function RevenueFormDialog({ mode, trigger }: RevenueFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<RevenueFormData>({
    resolver: zodResolver(revenueFormSchema),
    defaultValues: {
      source: "",
      customer: "",
      invoiceNumber: "",
      amount: "",
      tax: "0",
      paymentMethod: "BANK_TRANSFER",
      date: new Date().toISOString().split("T")[0],
    },
  });

  const onSubmit = async (data: RevenueFormData) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("source", data.source);
      formData.append("customer", data.customer);
      formData.append("invoiceNumber", data.invoiceNumber);
      formData.append("amount", data.amount);
      formData.append("tax", data.tax || "0");
      formData.append("paymentMethod", data.paymentMethod);
      formData.append("date", data.date);

      const result = await createRevenue(formData);

      if (result.success) {
        toast.success("Revenue recorded successfully");
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
      Add Revenue
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Record New Revenue</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source">Revenue Source *</Label>
              <Select
                value={form.watch("source")}
                onValueChange={(value) => form.setValue("source", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {REVENUE_SOURCES.map((src) => (
                    <SelectItem key={src} value={src}>
                      {src}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.source && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.source.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Input
                id="customer"
                placeholder="Customer name"
                {...form.register("customer")}
              />
              {form.formState.errors.customer && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.customer.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number *</Label>
              <Input
                id="invoiceNumber"
                placeholder="INV-001"
                {...form.register("invoiceNumber")}
              />
              {form.formState.errors.invoiceNumber && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.invoiceNumber.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <Select
                value={form.watch("paymentMethod")}
                onValueChange={(value) =>
                  form.setValue("paymentMethod", value as any)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                </SelectContent>
              </Select>
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
              <Label htmlFor="tax">Tax / VAT (IDR)</Label>
              <Input
                id="tax"
                type="number"
                placeholder="0"
                {...form.register("tax")}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="date">Transaction Date *</Label>
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
              {loading ? "Saving..." : "Record Revenue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
