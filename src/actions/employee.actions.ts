"use server";

import { revalidatePath } from "next/cache";
import { employeeRepository } from "@/infrastructure/repositories/employee.repository";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { requireAuth, AuthorizationError, ForbiddenError } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { ISalaryConfig } from "@/infrastructure/database/models/Employee";

const employeeSchema = z.object({
  nik: z.string().min(3),
  name: z.string().min(2),
  email: z.string().email(),
  npwp: z.string().optional(),
  bpjsNumber: z.string().optional(),
  employmentStatus: z.enum(["PERMANENT", "CONTRACT", "PROBATION"]),
  joinDate: z.string(),
  basicSalary: z.number().positive(),
  ptkpStatus: z.string().default("TK/0"),
});

export async function createEmployee(formData: FormData) {
  try {
    // 1. Authenticate and get session context
    const session = await requireAuth();
    
    // 2. Check permission - HR_ADMIN or SUPER_ADMIN can create employees
    requirePermission(session, "EMPLOYEE", "CREATE");

    await connectToDatabase();

    const parsed = employeeSchema.parse({
      nik: formData.get("nik"),
      name: formData.get("name"),
      email: formData.get("email"),
      npwp: formData.get("npwp") || undefined,
      bpjsNumber: formData.get("bpjsNumber") || undefined,
      employmentStatus: formData.get("employmentStatus"),
      joinDate: formData.get("joinDate"),
      basicSalary: parseFloat(formData.get("basicSalary") as string),
      ptkpStatus: formData.get("ptkpStatus") || "TK/0",
    });

    // Check if NIK already exists
    const existingEmployee = await employeeRepository.findByNik(session.companyId, parsed.nik);
    if (existingEmployee) {
      return { success: false, error: "Employee with this NIK already exists" };
    }

    const salaryConfig: ISalaryConfig = {
      basicSalary: mongoose.Types.Decimal128.fromString(parsed.basicSalary.toString()),
      allowances: [],
      deductions: [],
      bpjsKesehatan: true,
      bpjsKetenagakerjaan: true,
      ptkpStatus: parsed.ptkpStatus
    };

    const employee = await employeeRepository.create(session.companyId, {
      nik: parsed.nik,
      name: parsed.name,
      email: parsed.email,
      npwp: parsed.npwp,
      bpjsNumber: parsed.bpjsNumber,
      employmentStatus: parsed.employmentStatus,
      joinDate: new Date(parsed.joinDate),
      salaryConfig,
      isActive: true,
    });

    await logAction({
      companyId: session.companyId,
      userId: session.userId,
      action: "CREATE",
      module: "EMPLOYEE",
      resourceId: employee._id.toString(),
      newValue: { nik: parsed.nik, name: parsed.name }
    });

    revalidatePath("/dashboard/payroll/employees");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: "Please log in to continue" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Update employee basic info and salary
 */
export async function updateEmployee(employeeId: string, formData: FormData) {
  try {
    const session = await requireAuth();
    requirePermission(session, "EMPLOYEE", "UPDATE");

    await connectToDatabase();

    const parsed = employeeSchema.parse({
      nik: formData.get("nik"),
      name: formData.get("name"),
      email: formData.get("email"),
      npwp: formData.get("npwp") || undefined,
      bpjsNumber: formData.get("bpjsNumber") || undefined,
      employmentStatus: formData.get("employmentStatus"),
      joinDate: formData.get("joinDate"),
      basicSalary: parseFloat(formData.get("basicSalary") as string),
      ptkpStatus: formData.get("ptkpStatus") || "TK/0",
    });

    const existingEmployee = await employeeRepository.findById(session.companyId, employeeId);
    if (!existingEmployee) {
      return { success: false, error: "Employee not found" };
    }

    // Check if NIK already exists for another employee
    const employeeWithNik = await employeeRepository.findByNik(session.companyId, parsed.nik);
    if (employeeWithNik && employeeWithNik._id.toString() !== employeeId) {
      return { success: false, error: "Another employee with this NIK already exists" };
    }

    const salaryConfig: ISalaryConfig = {
      basicSalary: mongoose.Types.Decimal128.fromString(parsed.basicSalary.toString()),
      allowances: existingEmployee.salaryConfig.allowances || [],
      deductions: existingEmployee.salaryConfig.deductions || [],
      bpjsKesehatan: existingEmployee.salaryConfig.bpjsKesehatan,
      bpjsKetenagakerjaan: existingEmployee.salaryConfig.bpjsKetenagakerjaan,
      ptkpStatus: parsed.ptkpStatus,
    };

    await employeeRepository.updateById(session.companyId, employeeId, {
      $set: {
        nik: parsed.nik,
        name: parsed.name,
        email: parsed.email,
        npwp: parsed.npwp,
        bpjsNumber: parsed.bpjsNumber,
        employmentStatus: parsed.employmentStatus,
        joinDate: new Date(parsed.joinDate),
        salaryConfig,
      }
    });

    await logAction({
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      module: "EMPLOYEE",
      resourceId: employeeId,
      oldValue: { name: existingEmployee.name, nik: existingEmployee.nik },
      newValue: { name: parsed.name, nik: parsed.nik }
    });

    revalidatePath("/payroll/employees");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: "Please log in to continue" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Update employee salary configuration
 */
export async function updateEmployeeSalary(
  employeeId: string,
  salaryConfig: {
    basicSalary: number;
    allowances?: Array<{ name: string; amount: number }>;
    deductions?: Array<{ name: string; amount: number }>;
    ptkpStatus?: string;
    bpjsKesehatan?: boolean;
    bpjsKetenagakerjaan?: boolean;
  }
) {
  try {
    const session = await requireAuth();
    requirePermission(session, "EMPLOYEE", "UPDATE");

    await connectToDatabase();

    const existingEmployee = await employeeRepository.findById(session.companyId, employeeId);
    if (!existingEmployee) {
      return { success: false, error: "Employee not found" };
    }

    const newConfig: ISalaryConfig = {
      basicSalary: mongoose.Types.Decimal128.fromString(salaryConfig.basicSalary.toString()),
      allowances: (salaryConfig.allowances || []).map(a => ({
        name: a.name,
        amount: mongoose.Types.Decimal128.fromString(a.amount.toString()),
      })),
      deductions: (salaryConfig.deductions || []).map(d => ({
        name: d.name,
        amount: mongoose.Types.Decimal128.fromString(d.amount.toString()),
      })),
      bpjsKesehatan: salaryConfig.bpjsKesehatan ?? true,
      bpjsKetenagakerjaan: salaryConfig.bpjsKetenagakerjaan ?? true,
      ptkpStatus: salaryConfig.ptkpStatus || existingEmployee.salaryConfig.ptkpStatus,
    };

    await employeeRepository.updateSalaryConfig(session.companyId, employeeId, newConfig);

    await logAction({
      companyId: session.companyId,
      userId: session.userId,
      action: "UPDATE",
      module: "EMPLOYEE",
      resourceId: employeeId,
      oldValue: { basicSalary: existingEmployee.salaryConfig.basicSalary.toString() },
      newValue: { basicSalary: salaryConfig.basicSalary }
    });

    revalidatePath("/dashboard/payroll/employees");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: "Please log in to continue" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Deactivate employee (soft delete)
 */
export async function deactivateEmployee(employeeId: string) {
  try {
    const session = await requireAuth();
    requirePermission(session, "EMPLOYEE", "DELETE");

    await connectToDatabase();

    const employee = await employeeRepository.findById(session.companyId, employeeId);
    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    await employeeRepository.deactivate(session.companyId, employeeId);

    await logAction({
      companyId: session.companyId,
      userId: session.userId,
      action: "DELETE",
      module: "EMPLOYEE",
      resourceId: employeeId,
      oldValue: { isActive: true },
      newValue: { isActive: false }
    });

    revalidatePath("/dashboard/payroll/employees");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: "Please log in to continue" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error.message };
  }
}
