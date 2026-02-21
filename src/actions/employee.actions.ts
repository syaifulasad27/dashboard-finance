"use server";

import { revalidatePath } from "next/cache";
import { EmployeeModel, ISalaryConfig } from "@/infrastructure/database/models/Employee";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

const employeeSchema = z.object({
  companyId: z.string(),
  nik: z.string().min(3),
  name: z.string().min(2),
  email: z.string().email(),
  employmentStatus: z.enum(["PERMANENT", "CONTRACT", "PROBATION"]),
  joinDate: z.string(),
  basicSalary: z.number().positive(),
});

export async function createEmployee(formData: FormData) {
  try {
    await connectToDatabase();
    const companyId = formData.get("companyId") as string;

    const parsed = employeeSchema.parse({
      companyId,
      nik: formData.get("nik"),
      name: formData.get("name"),
      email: formData.get("email"),
      employmentStatus: formData.get("employmentStatus"),
      joinDate: formData.get("joinDate"),
      basicSalary: parseFloat(formData.get("basicSalary") as string),
    });

    const salaryConfig: ISalaryConfig = {
      basicSalary: mongoose.Types.Decimal128.fromString(parsed.basicSalary.toString()),
      allowances: [],
      deductions: [],
      bpjsKesehatan: true,
      bpjsKetenagakerjaan: true,
      ptkpStatus: "TK/0"
    };

    const employee = new EmployeeModel({
      companyId: new mongoose.Types.ObjectId(parsed.companyId),
      nik: parsed.nik,
      name: parsed.name,
      email: parsed.email,
      employmentStatus: parsed.employmentStatus,
      joinDate: new Date(parsed.joinDate),
      salaryConfig
    });

    await employee.save();

    revalidatePath("/dashboard/payroll/employees");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
