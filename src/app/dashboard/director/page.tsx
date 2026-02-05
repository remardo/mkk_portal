"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts"
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

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

export default function DirectorDashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [branchStats, setBranchStats] = useState<any[]>([])
  const [taskStats, setTaskStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
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
  }

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
  const taskTypeData = taskStats.reduce((acc: any[], item: any) => {
    const existing = acc.find(a => a.name === item.type)
    if (existing) {
      existing.count += item.count
    } else {
      acc.push({ name: item.type, count: item.count || 0 })
    }
    return acc
  }, [])

  const checklistData = branchStats.map(b => ({
    name: b.branch_name,
    overdue: b.overdue_checklists || 0,
    completed: b.completed_checklists_7d || 0,
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

      {/* Charts */}
      <Tabs defaultValue="checklists">
        <TabsList>
          <TabsTrigger value="checklists">Чек-листы</TabsTrigger>
          <TabsTrigger value="tasks">Задачи</TabsTrigger>
          <TabsTrigger value="certifications">Аттестации</TabsTrigger>
        </TabsList>
        
        <TabsContent value="checklists" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Выполнение чек-листов по точкам</CardTitle>
              <CardDescription>
                Просроченные и выполненные за 7 дней
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={checklistData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="overdue" fill="#ef4444" name="Просрочено" />
                    <Bar dataKey="completed" fill="#10b981" name="Выполнено" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Задачи по типам</CardTitle>
              <CardDescription>
                Распределение открытых задач
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {taskTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="certifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Статус аттестаций</CardTitle>
              <CardDescription>
                Сотрудники с актуальными сертификатами
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={certificationData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                      {branch.overdue_checklists > 0 ? (
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
