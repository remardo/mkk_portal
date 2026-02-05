"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Building2, MapPin, Phone, Clock, Users, Mail } from "lucide-react"
import { BranchWithManager, Profile } from "@/types/database"
import { getRoleLabel } from "@/lib/utils"

export default function ContactsPage() {
  const [branches, setBranches] = useState<BranchWithManager[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch branches with managers
      const { data: branchesData } = await supabase
        .from("branches")
        .select("*, ops_manager:profiles!branches_ops_manager_id_fkey(full_name, phone)")
        .eq("is_active", true)
        .order("city")
      
      setBranches(branchesData || [])
      
      // Fetch employees
      const { data: employeesData } = await supabase
        .from("profiles")
        .select("*, branch:branches(name)")
        .eq("is_active", true)
        .order("full_name")
      
      setEmployees(employeesData || [])
    } catch (error) {
      console.error("Error fetching contacts:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredBranches = branches.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredEmployees = employees.filter(e =>
    e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getRoleLabel(e.role).toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.branch?.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group branches by region/city
  const branchesByCity = filteredBranches.reduce((acc, branch) => {
    const city = branch.city
    if (!acc[city]) acc[city] = []
    acc[city].push(branch)
    return acc
  }, {} as Record<string, BranchWithManager[]>)

  // Group employees by role
  const employeesByRole = filteredEmployees.reduce((acc, emp) => {
    const role = getRoleLabel(emp.role)
    if (!acc[role]) acc[role] = []
    acc[role].push(emp)
    return acc
  }, {} as Record<string, Profile[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Структура и контакты</h1>
        <p className="text-muted-foreground mt-1">
          Точки выдачи и контакты сотрудников
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по точкам, сотрудникам..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="branches">
        <TabsList>
          <TabsTrigger value="branches">
            <Building2 className="h-4 w-4 mr-2" />
            Точки
          </TabsTrigger>
          <TabsTrigger value="employees">
            <Users className="h-4 w-4 mr-2" />
            Сотрудники
          </TabsTrigger>
          <TabsTrigger value="services">
            <Phone className="h-4 w-4 mr-2" />
            Службы
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="branches" className="mt-6">
          <div className="space-y-6">
            {Object.entries(branchesByCity).map(([city, cityBranches]) => (
              <div key={city}>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {city}
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {cityBranches.map((branch) => (
                    <Card key={branch.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{branch.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {branch.address}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {branch.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <a href={`tel:${branch.phone}`} className="hover:underline">
                              {branch.phone}
                            </a>
                          </div>
                        )}
                        {branch.working_hours && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {branch.working_hours}
                          </div>
                        )}
                        {branch.ops_manager && (
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>Руководитель: {branch.ops_manager.full_name}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="employees" className="mt-6">
          <div className="space-y-6">
            {Object.entries(employeesByRole).map(([role, roleEmployees]) => (
              <div key={role}>
                <h2 className="text-lg font-semibold mb-4">{role}</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  {roleEmployees.map((emp) => (
                    <Card key={emp.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{emp.full_name}</CardTitle>
                        <CardDescription>
                          {emp.branch?.name || "Центральный офис"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-sm text-muted-foreground">
                          {emp.email}
                        </div>
                        {emp.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4" />
                            <a href={`tel:${emp.phone}`} className="hover:underline">
                              {emp.phone}
                            </a>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="services" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  IT-поддержка
                </CardTitle>
                <CardDescription>
                  Технические проблемы и вопросы
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">
                  <strong>Email:</strong> it@mkk-fk.ru
                </p>
                <p className="text-sm">
                  <strong>Телефон:</strong> внутренний 101
                </p>
                <p className="text-sm text-muted-foreground">
                  Режим работы: Пн-Пт 9:00-18:00
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Операционный отдел
                </CardTitle>
                <CardDescription>
                  Операционные вопросы
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">
                  <strong>Email:</strong> ops@mkk-fk.ru
                </p>
                <p className="text-sm">
                  <strong>Телефон:</strong> внутренний 102
                </p>
                <p className="text-sm text-muted-foreground">
                  Режим работы: Пн-Пт 9:00-18:00
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Бухгалтерия
                </CardTitle>
                <CardDescription>
                  Финансовые вопросы
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">
                  <strong>Email:</strong> accounting@mkk-fk.ru
                </p>
                <p className="text-sm">
                  <strong>Телефон:</strong> внутренний 103
                </p>
                <p className="text-sm text-muted-foreground">
                  Режим работы: Пн-Пт 9:00-18:00
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Отдел безопасности
                </CardTitle>
                <CardDescription>
                  Вопросы безопасности и верификации
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">
                  <strong>Email:</strong> security@mkk-fk.ru
                </p>
                <p className="text-sm">
                  <strong>Телефон:</strong> внутренний 104
                </p>
                <p className="text-sm text-muted-foreground">
                  Режим работы: круглосуточно
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
