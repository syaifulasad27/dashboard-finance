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
import { createEmployee, updateEmployee } from "@/actions/employee.actions";
import { Plus, Pencil } from "lucide-react";

const employeeFormSchema = z.object({
  nik: z.string().min(3, "NIK must be at least 3 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  npwp: z.string().optional(),
  bpjsNumber: z.string().optional(),
  employmentStatus: z.enum(["PERMANENT", "CONTRACT", "PROBATION"]),
  joinDate: z.string().min(1, "Join date is required"),
  basicSalary: z.string().min(1, "Basic salary is required"),
  ptkpStatus: z.string().default("TK/0"),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

interface EmployeeFormDialogProps {
  mode: "create" | "edit";
  employee?: {
    _id: string;
    nik: string;
    name: string;
    email: string;
    npwp?: string;
    bpjsNumber?: string;
    employmentStatus: "PERMANENT" | "CONTRACT" | "PROBATION";
    joinDate: Date | string;
    salaryConfig: {
      basicSalary: { toString: () => string } | string | number;
      ptkpStatus: string;
    };
  };
  trigger?: React.ReactNode;
}

export function EmployeeFormDialog({ mode, employee, trigger }: EmployeeFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      nik: employee?.nik || "",
      name: employee?.name || "",
      email: employee?.email || "",
      npwp: employee?.npwp || "",
      bpjsNumber: employee?.bpjsNumber || "",
      employmentStatus: employee?.employmentStatus || "PERMANENT",
      joinDate: employee?.joinDate
        ? new Date(employee.joinDate).toISOString().split("T")[0]
        : "",
      basicSalary: employee?.salaryConfig?.basicSalary
        ? typeof employee.salaryConfig.basicSalary === "object"
          ? employee.salaryConfig.basicSalary.toString()
          : String(employee.salaryConfig.basicSalary)
        : "",
      ptkpStatus: employee?.salaryConfig?.ptkpStatus || "TK/0",
    },
  });

  const onSubmit = async (data: EmployeeFormData) => {
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      });

      let result;
      if (mode === "edit" && employee) {
        result = await updateEmployee(employee._id, formData);
      } else {
        result = await createEmployee(formData);
      }

      if (result.success) {
        toast.success(mode === "create" ? "Employee created successfully" : "Employee updated successfully");
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

  const defaultTrigger =
    mode === "create" ? (
      <Button>
        <Plus className="mr-2 h-4 w-4" />
        Add Employee
      </Button>
    ) : (
      <Button variant="ghost" size="sm">
        <Pencil className="h-4 w-4" />
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add New Employee" : "Edit Employee"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nik">NIK *</Label>
              <Input
                id="nik"
                placeholder="Employee ID"
                {...form.register("nik")}
              />
              {form.formState.errors.nik && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.nik.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="John Doe"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@company.com"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="employmentStatus">Employment Status *</Label>
              <Select
                value={form.watch("employmentStatus")}
                onValueChange={(value) =>
                  form.setValue("employmentStatus", value as any)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERMANENT">Permanent</SelectItem>
                  <SelectItem value="CONTRACT">Contract</SelectItem>
                  <SelectItem value="PROBATION">Probation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="joinDate">Join Date *</Label>
              <Input id="joinDate" type="date" {...form.register("joinDate")} />
              {form.formState.errors.joinDate && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.joinDate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="basicSalary">Basic Salary (IDR) *</Label>
              <Input
                id="basicSalary"
                type="number"
                placeholder="5000000"
                {...form.register("basicSalary")}
              />
              {form.formState.errors.basicSalary && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.basicSalary.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="npwp">NPWP</Label>
              <Input
                id="npwp"
                placeholder="00.000.000.0-000.000"
                {...form.register("npwp")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bpjsNumber">BPJS Number</Label>
              <Input
                id="bpjsNumber"
                placeholder="0000000000000"
                {...form.register("bpjsNumber")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ptkpStatus">PTKP Status</Label>
              <Select
                value={form.watch("ptkpStatus")}
                onValueChange={(value) => form.setValue("ptkpStatus", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select PTKP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TK/0">TK/0 - Tidak Kawin</SelectItem>
                  <SelectItem value="TK/1">TK/1 - Tidak Kawin, 1 Tanggungan</SelectItem>
                  <SelectItem value="TK/2">TK/2 - Tidak Kawin, 2 Tanggungan</SelectItem>
                  <SelectItem value="TK/3">TK/3 - Tidak Kawin, 3 Tanggungan</SelectItem>
                  <SelectItem value="K/0">K/0 - Kawin, 0 Tanggungan</SelectItem>
                  <SelectItem value="K/1">K/1 - Kawin, 1 Tanggungan</SelectItem>
                  <SelectItem value="K/2">K/2 - Kawin, 2 Tanggungan</SelectItem>
                  <SelectItem value="K/3">K/3 - Kawin, 3 Tanggungan</SelectItem>
                  <SelectItem value="K/I/0">K/I/0 - Kawin, Istri Kerja</SelectItem>
                  <SelectItem value="K/I/1">K/I/1 - Kawin, Istri Kerja, 1 Tanggungan</SelectItem>
                  <SelectItem value="K/I/2">K/I/2 - Kawin, Istri Kerja, 2 Tanggungan</SelectItem>
                  <SelectItem value="K/I/3">K/I/3 - Kawin, Istri Kerja, 3 Tanggungan</SelectItem>
                </SelectContent>
              </Select>
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
              {loading
                ? "Saving..."
                : mode === "create"
                ? "Create Employee"
                : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
