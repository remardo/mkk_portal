"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

const DirectorCharts = dynamic(() => import("@/components/director-charts"), {
  ssr: false,
  loading: () => <Card className="h-[300px]" />,
})
import { 
  Users, 
  Building2, 
  CheckSquare, 
  GraduationCap, 
  AlertCircle,
  TrendingUp,
  Clock
} from "lucide-react"
import { toast } from "sonner"

export default function DirectorDashboardPage() {
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [branchStats, setBranchStats] = useState<Record<string, number | string>[]>([])
  const [taskStats, setTaskStats] = useState<{ type: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch director dashboard stats
      const { data: directorStats } = await supabase
        .rpc("get_director_dashboard")
      
      if (directorStats && directorStats.length > 0) {
        setStats(directorStats[0])
      }
      
      // Fetch branch stats
      const { data: branches } = await supabase
        .from("v_branch_stats")
        .select("*")
      
      setBranchStats(branches || [])
      
      // Fetch task stats by type
      const { data: tasks } = await supabase
        .from("v_tasks_by_type_stats")
        .select("*")
      
      setTaskStats(tasks || [])
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      toast.error("Ошибка при загрузке данных")
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Дэшборд директора</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  // Prepare chart data
  const taskTypeData = taskStats.reduce<{ name: string; count: number }[]>((acc, item) => {
    const existing = acc.find(a => a.name === item.type)
    if (existing) {
      existing.count += item.count
    } else {
      acc.push({ name: item.type, count: item.count || 0 })
    }
    return acc
  }, [])

  const checklistData = branchStats.map(b => ({
    name: String(b.branch_name ?? ""),
    overdue: Number(b.overdue_checklists ?? 0),
    completed: Number(b.completed_checklists_7d ?? 0),
  })).slice(0, 10)

  const certificationData = [
    { name: "Актуальны", value: stats?.employees_with_actual_certifications || 0 },
    { name: "Требуют обновления", value: (stats?.total_active_employees || 0) - (stats?.employees_with_actual_certifications || 0) },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Дэшборд директора</h1>
        <p className="text-muted-foreground mt-1">
          Сводные показатели компании
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Сотрудники</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_employees || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.total_active_employees || 0} активных
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Точки</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_branches || 0}</div>
            <p className="text-xs text-muted-foreground">активных точек</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Аттестации</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.certification_compliance_percent?.toFixed(1) || 0}%
            </div>
            <Progress 
              value={stats?.certification_compliance_percent || 0} 
              className="h-2 mt-2" 
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Открытые задачи</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.open_tasks || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.overdue_tasks || 0} просрочено
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts (lazy: recharts не входит в начальный чанк) */}
      <DirectorCharts
        checklistData={checklistData}
        taskTypeData={taskTypeData}
        certificationData={certificationData}
      />

      {/* Branch Table */}
      <Card>
        <CardHeader>
          <CardTitle>Статистика по точкам</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Точка</th>
                  <th className="text-left py-3 px-4">Город</th>
                  <th className="text-center py-3 px-4">Сотрудники</th>
                  <th className="text-center py-3 px-4">Задачи</th>
                  <th className="text-center py-3 px-4">Просроченные чек-листы</th>
                </tr>
              </thead>
              <tbody>
                {branchStats.map((branch) => (
                  <tr key={branch.branch_id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{branch.branch_name}</td>
                    <td className="py-3 px-4">{branch.city}</td>
                    <td className="py-3 px-4 text-center">{branch.employee_count}</td>
                    <td className="py-3 px-4 text-center">{branch.open_tasks}</td>
                    <td className="py-3 px-4 text-center">
                      {Number(branch.overdue_checklists) > 0 ? (
                        <Badge variant="destructive">{branch.overdue_checklists}</Badge>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
