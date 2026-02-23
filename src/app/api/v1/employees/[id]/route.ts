import { NextRequest } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { 
  validateApiRequest, 
  checkApiPermission, 
  apiError, 
  apiSuccess 
} from "@/lib/api-middleware";
import { EmployeeModel } from "@/infrastructure/database/models/Employee";
import { logAction } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to format Decimal128
function formatDecimal(value: unknown): number {
  if (!value) return 0;
  return parseFloat(value.toString());
}

// GET /api/v1/employees/[id] - Get single employee
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "EMPLOYEE", "READ");
  if (permError) return permError;

  try {
    await connectToDatabase();
    const { id } = await params;

    const employee = await EmployeeModel.findOne({ _id: id, companyId })
      .populate("departmentId", "name")
      .populate("costCenterId", "code name")
      .lean();

    if (!employee) {
      return apiError("Employee not found", 404);
    }

    return apiSuccess({
      id: employee._id.toString(),
      nik: employee.nik,
      name: employee.name,
      email: employee.email,
      npwp: employee.npwp,
      bpjsNumber: employee.bpjsNumber,
      employmentStatus: employee.employmentStatus,
      joinDate: employee.joinDate,
      department: employee.departmentId,
      costCenter: employee.costCenterId,
      salaryConfig: {
        basicSalary: formatDecimal(employee.salaryConfig?.basicSalary),
        allowances: employee.salaryConfig?.allowances?.map((a: { name: string; amount: unknown }) => ({
          name: a.name,
          amount: formatDecimal(a.amount),
        })) || [],
        deductions: employee.salaryConfig?.deductions?.map((d: { name: string; amount: unknown }) => ({
          name: d.name,
          amount: formatDecimal(d.amount),
        })) || [],
        bpjsKesehatan: employee.salaryConfig?.bpjsKesehatan,
        bpjsKetenagakerjaan: employee.salaryConfig?.bpjsKetenagakerjaan,
        ptkpStatus: employee.salaryConfig?.ptkpStatus,
      },
      isActive: employee.isActive,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    });
  } catch (error) {
    console.error("API GET employee error:", error);
    return apiError("Failed to fetch employee");
  }
}

// PUT /api/v1/employees/[id] - Update employee
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { userId, companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "EMPLOYEE", "UPDATE");
  if (permError) return permError;

  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await request.json();

    const employee = await EmployeeModel.findOne({ _id: id, companyId });
    if (!employee) {
      return apiError("Employee not found", 404);
    }

    // Build update object
    const update: Record<string, unknown> = {};
    
    if (body.name) update.name = body.name;
    if (body.email) update.email = body.email;
    if (body.npwp !== undefined) update.npwp = body.npwp;
    if (body.bpjsNumber !== undefined) update.bpjsNumber = body.bpjsNumber;
    if (body.departmentId !== undefined) update.departmentId = body.departmentId;
    if (body.costCenterId !== undefined) update.costCenterId = body.costCenterId;
    if (body.employmentStatus) update.employmentStatus = body.employmentStatus;
    if (body.joinDate) update.joinDate = new Date(body.joinDate);
    if (body.isActive !== undefined) update.isActive = body.isActive;

    // Update salary config if provided
    if (body.basicSalary !== undefined || body.allowances || body.deductions || body.ptkpStatus) {
      update.salaryConfig = {
        ...employee.salaryConfig,
        ...(body.basicSalary !== undefined && { basicSalary: body.basicSalary }),
        ...(body.allowances && { allowances: body.allowances }),
        ...(body.deductions && { deductions: body.deductions }),
        ...(body.ptkpStatus && { ptkpStatus: body.ptkpStatus }),
        ...(body.bpjsKesehatan !== undefined && { bpjsKesehatan: body.bpjsKesehatan }),
        ...(body.bpjsKetenagakerjaan !== undefined && { bpjsKetenagakerjaan: body.bpjsKetenagakerjaan }),
      };
    }

    await EmployeeModel.updateOne({ _id: id, companyId }, { $set: update });

    await logAction({
      action: "UPDATE",
      module: "EMPLOYEE",
      resourceId: id,
      userId,
      companyId,
      oldValue: { name: employee.name },
      newValue: update,
    });

    return apiSuccess({ id });
  } catch (error) {
    console.error("API PUT employee error:", error);
    return apiError("Failed to update employee");
  }
}

// DELETE /api/v1/employees/[id] - Delete/deactivate employee
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { userId, companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "EMPLOYEE", "DELETE");
  if (permError) return permError;

  try {
    await connectToDatabase();
    const { id } = await params;

    const employee = await EmployeeModel.findOne({ _id: id, companyId });
    if (!employee) {
      return apiError("Employee not found", 404);
    }

    // Soft delete - deactivate instead of hard delete
    await EmployeeModel.updateOne(
      { _id: id, companyId },
      { $set: { isActive: false } }
    );

    await logAction({
      action: "DELETE",
      module: "EMPLOYEE",
      resourceId: id,
      userId,
      companyId,
      oldValue: { name: employee.name, isActive: true },
    });

    return apiSuccess({ id, message: "Employee deactivated" });
  } catch (error) {
    console.error("API DELETE employee error:", error);
    return apiError("Failed to delete employee");
  }
}
