import Link from "next/link";
import { LayoutDashboard, BookOpen, FileText, Users, Calculator, BarChart3, Settings } from "lucide-react";

export function Sidebar() {
  return (
    <div className="w-64 border-r bg-background h-full flex flex-col">
      <div className="p-6">
        <h2 className="text-2xl font-bold tracking-tight text-primary">Kukerja Fin</h2>
      </div>

      <div className="flex-1 overflow-auto py-2">
        <nav className="grid gap-1 px-4">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link href="/journal" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <BookOpen className="h-4 w-4" />
            Journal Entries
          </Link>
          <Link href="/revenue" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <FileText className="h-4 w-4" />
            Revenue
          </Link>
          <Link href="/expense" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Calculator className="h-4 w-4" />
            Expense
          </Link>
          <Link href="/payroll" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Users className="h-4 w-4" />
            Payroll & Staff
          </Link>
          <Link href="/reports" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <BarChart3 className="h-4 w-4" />
            Reports
          </Link>
          <Link href="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground mt-4">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </nav>
      </div>
    </div>
  );
}
