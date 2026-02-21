import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { ReportingEngine } from "@/core/engines/reporting.engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinancialChart } from "@/components/dashboard/financial-chart";

export default async function DashboardPage() {
  await connectToDatabase();
  const companyId = "60d5ecb8b392d22b28f745d0"; // Mock session company

  const metrics = await ReportingEngine.getDashboardMetrics(companyId);

  // Prepare chart data (Current year performance)
  // For MVP, we'll use actual data for current month and mock others for visual aesthetics
  const chartData = [
    { name: "Jan", revenue: 0, expense: 0 },
    { name: "Feb", revenue: metrics.revenue, expense: metrics.expenses },
    { name: "Mar", revenue: 0, expense: 0 },
    { name: "Apr", revenue: 0, expense: 0 },
    { name: "May", revenue: 0, expense: 0 },
    { name: "Jun", revenue: 0, expense: 0 },
  ];

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Financial Global Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Cash Position</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">Rp {metrics.cashPosition.toLocaleString("id-ID")}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue (YTD)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">Rp {metrics.revenue.toLocaleString("id-ID")}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses (YTD)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">Rp {metrics.expenses.toLocaleString("id-ID")}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">Rp {metrics.netProfit.toLocaleString("id-ID")}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <FinancialChart data={chartData} />
      </div>
    </div>
  );
}
