"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

type Props = {
  checklistData: { name: string; overdue: number; completed: number }[]
  taskTypeData: { name: string; count: number }[]
  certificationData: { name: string; value: number }[]
}

export default function DirectorCharts({ checklistData, taskTypeData, certificationData }: Props) {
  return (
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
            <CardDescription>Просроченные и выполненные за 7 дней</CardDescription>
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
            <CardDescription>Распределение открытых задач</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={taskTypeData} cx="50%" cy="50%" labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    outerRadius={100} fill="#8884d8" dataKey="count">
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
            <CardDescription>Сотрудники с актуальными сертификатами</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={certificationData} cx="50%" cy="50%" labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100} fill="#8884d8" dataKey="value">
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
  )
}
