import { NextRequest } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { 
  validateApiRequest, 
  checkApiPermission, 
  apiError, 
  apiSuccess, 
  parsePagination 
} from "@/lib/api-middleware";
import { EmployeeModel } from "@/infrastructure/database/models/Employee";
import { logAction } from "@/lib/logger";

// Helper to format Decimal128
function formatDecimal(value: unknown): number {
  if (!value) return 0;
  return parseFloat(value.toString());
}

// GET /api/v1/employees - List employees
export async function GET(request: NextRequest) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "EMPLOYEE", "READ");
  if (permError) return permError;

  try {
    await connectToDatabase();
    
    const { page, limit, skip } = parsePagination(request);
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("isActive");
    const department = searchParams.get("departmentId");
    
    const query: Record<string, unknown> = { companyId };
    if (isActive !== null) query.isActive = isActive === "true";
    if (department) query.departmentId = department;

    const [employees, total] = await Promise.all([
      EmployeeModel.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ name: 1 })
        .populate("departmentId", "name")
        .populate("costCenterId", "code name")
        .lean(),
      EmployeeModel.countDocuments(query),
    ]);

    const formatted = employees.map(e => ({
      id: e._id.toString(),
      nik: e.nik,
      name: e.name,
      email: e.email,
      npwp: e.npwp,
      bpjsNumber: e.bpjsNumber,
      employmentStatus: e.employmentStatus,
      joinDate: e.joinDate,
      department: e.departmentId,
      costCenter: e.costCenterId,
      basicSalary: formatDecimal(e.salaryConfig?.basicSalary),
      ptkpStatus: e.salaryConfig?.ptkpStatus,
      isActive: e.isActive,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    return apiSuccess({
      employees: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("API GET employees error:", error);
    return apiError("Failed to fetch employees");
  }
}

// POST /api/v1/employees - Create employee
export async function POST(request: NextRequest) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { userId, companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "EMPLOYEE", "CREATE");
  if (permError) return permError;

  try {
    await connectToDatabase();
    
    const body = await request.json();
    
    // Validate required fields
    const required = ["nik", "name", "email", "employmentStatus", "joinDate", "basicSalary"];
    for (const field of required) {
      if (!body[field]) {
        return apiError(`Missing required field: ${field}`, 400);
      }
    }

    // Check for duplicate NIK
    const existing = await EmployeeModel.findOne({ companyId, nik: body.nik });
    if (existing) {
      return apiError("Employee with this NIK already exists", 409);
    }

    const employee = await EmployeeModel.create({
      companyId,
      nik: body.nik,
      name: body.name,
      email: body.email,
      npwp: body.npwp,
      bpjsNumber: body.bpjsNumber,
      departmentId: body.departmentId,
      costCenterId: body.costCenterId,
      employmentStatus: body.employmentStatus,
      joinDate: new Date(body.joinDate),
      salaryConfig: {
        basicSalary: body.basicSalary,
        allowances: body.allowances || [],
        deductions: body.deductions || [],
        bpjsKesehatan: body.bpjsKesehatan !== false,
        bpjsKetenagakerjaan: body.bpjsKetenagakerjaan !== false,
        ptkpStatus: body.ptkpStatus || "TK/0",
      },
      isActive: true,
    });

    await logAction({
      action: "CREATE",
      module: "EMPLOYEE",
      resourceId: employee._id.toString(),
      userId,
      companyId,
      newValue: { nik: body.nik, name: body.name },
    });

    return apiSuccess({ id: employee._id.toString() }, 201);
  } catch (error) {
    console.error("API POST employee error:", error);
    return apiError("Failed to create employee");
  }
}
