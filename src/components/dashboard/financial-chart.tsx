"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface FinancialChartProps {
  data: any[];
}

export function FinancialChart({ data }: FinancialChartProps) {
  // Mock data for display if none provided
  const chartData = data?.length ? data : [
    { name: "Jan", revenue: 4000, expense: 2400 },
    { name: "Feb", revenue: 3000, expense: 1398 },
    { name: "Mar", revenue: 2000, expense: 9800 },
    { name: "Apr", revenue: 2780, expense: 3908 },
    { name: "May", revenue: 1890, expense: 4800 },
    { name: "Jun", revenue: 2390, expense: 3800 },
  ];

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Financial Overview</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `Rp${value}`} />
            <Tooltip />
            <Bar dataKey="revenue" fill="#16a34a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="#dc2626" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
