"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import Link from "next/link"
import { ClipboardCheck, CheckCircle, Clock, AlertCircle, Camera, ChevronRight } from "lucide-react"
import { formatDate, getStatusColor, getChecklistStatusLabel, isOverdue } from "@/lib/utils"
import { ChecklistRunWithDetails, ChecklistItem, ChecklistRunItem } from "@/types/database"

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<ChecklistRunWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("*, branch:branches(*)")
        .eq("id", user.id)
        .single()
      
      setCurrentUser(profile)
      
      // Fetch checklists for user's branch
      const { data: checklistsData } = await supabase
        .from("checklist_runs")
        .select(`
          *,
          checklist:checklists(title, type),
          branch:branches(name)
        `)
        .eq("branch_id", profile.branch_id)
        .order("due_date", { ascending: true })
      
      // Fetch items for each checklist
      const checklistsWithItems = await Promise.all(
        (checklistsData || []).map(async (checklist) => {
          const { data: items } = await supabase
            .from("checklist_items")
            .select("*")
            .eq("checklist_id", checklist.checklist_id)
            .order("order", { ascending: true })
          
          const { data: runItems } = await supabase
            .from("checklist_run_items")
            .select("*")
            .eq("run_id", checklist.id)
          
          const runItemsMap = new Map(runItems?.map(ri => [ri.item_id, ri]) || [])
          
          return {
            ...checklist,
            items: items?.map(item => ({
              ...item,
              runItem: runItemsMap.get(item.id)
            })) || [],
            total_items: items?.length || 0,
            completed_items: runItems?.filter(ri => ri.checked).length || 0,
            is_overdue: isOverdue(checklist.due_date, checklist.status),
          }
        })
      )
      
      setChecklists(checklistsWithItems)
    } catch (error) {
      console.error("Error fetching checklists:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleItemCheck = async (runId: string, itemId: string, checked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { error } = await supabase
        .from("checklist_run_items")
        .upsert({
          run_id: runId,
          item_id: itemId,
          checked,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
      
      if (error) throw error
      
      // Update local state
      setChecklists(prev => prev.map(cl => {
        if (cl.id === runId) {
          const newItems = cl.items?.map(item => {
            if (item.id === itemId) {
              return { ...item, runItem: { ...item.runItem, checked } }
            }
            return item
          })
          const completedCount = newItems?.filter(i => i.runItem?.checked).length || 0
          return {
            ...cl,
            items: newItems,
            completed_items: completedCount,
          }
        }
        return cl
      }))
      
      toast.success("Сохранено")
    } catch (error) {
      console.error("Error updating checklist item:", error)
      toast.error("Ошибка при сохранении")
    }
  }

  const handleComplete = async (checklistId: string) => {
    try {
      const { error } = await supabase
        .from("checklist_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", checklistId)
      
      if (error) throw error
      
      toast.success("Чек-лист выполнен")
      fetchData()
    } catch (error) {
      console.error("Error completing checklist:", error)
      toast.error("Ошибка при завершении")
    }
  }

  const activeChecklists = checklists.filter(c => c.status !== "completed")
  const completedChecklists = checklists.filter(c => c.status === "completed")

  const ChecklistCard = ({ checklist }: { checklist: ChecklistRunWithDetails }) => {
    const progress = checklist.total_items 
      ? Math.round((checklist.completed_items / checklist.total_items) * 100) 
      : 0
    
    return (
      <Card className={checklist.is_overdue ? "border-red-200" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{checklist.checklist?.title}</CardTitle>
              <CardDescription>
                {checklist.branch?.name} • Срок: {formatDate(checklist.due_date)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {checklist.is_overdue && (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <Badge className={getStatusColor(checklist.status)}>
                {getChecklistStatusLabel(checklist.status)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Прогресс</span>
              <span>{checklist.completed_items} / {checklist.total_items}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          {/* Items */}
          {checklist.status !== "completed" && (
            <div className="space-y-2">
              {checklist.items?.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg border">
                  <Checkbox
                    checked={item.runItem?.checked || false}
                    onCheckedChange={(checked) => 
                      handleItemCheck(checklist.id, item.id, checked as boolean)
                    }
                  />
                  <div className="flex-1">
                    <p className={`text-sm ${item.runItem?.checked ? "line-through text-muted-foreground" : ""}`}>
                      {item.title}
                    </p>
                    {item.type === "photo" && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Camera className="h-3 w-3" />
                        Требуется фото
                      </span>
                    )}
                  </div>
                  {item.required && (
                    <Badge variant="outline" className="text-xs">Обязательно</Badge>
                  )}
                </div>
              ))}
              
              {checklist.items && checklist.items.length > 3 && (
                <p className="text-sm text-muted-foreground text-center">
                  +{checklist.items.length - 3} пунктов
                </p>
              )}
              
              {/* Complete Button */}
              {progress === 100 && (
                <Button 
                  className="w-full mt-4"
                  onClick={() => handleComplete(checklist.id)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Завершить чек-лист
                </Button>
              )}
            </div>
          )}
          
          {checklist.status === "completed" && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>Выполнен {formatDate(checklist.completed_at)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Чек-листы</h1>
        <p className="text-muted-foreground mt-1">
          Контрольные списки для точек
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Активные
            {activeChecklists.length > 0 && (
              <Badge variant="secondary" className="ml-2">{activeChecklists.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Выполненные</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {activeChecklists.length > 0 ? (
              activeChecklists.map((checklist) => (
                <ChecklistCard key={checklist.id} checklist={checklist} />
              ))
            ) : (
              <Card className="md:col-span-2">
                <CardContent className="py-12 text-center">
                  <ClipboardCheck className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">Нет активных чек-листов</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="completed" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {completedChecklists.length > 0 ? (
              completedChecklists.map((checklist) => (
                <ChecklistCard key={checklist.id} checklist={checklist} />
              ))
            ) : (
              <Card className="md:col-span-2">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Нет выполненных чек-листов</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
