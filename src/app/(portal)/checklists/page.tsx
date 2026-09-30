"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { ClipboardCheck, CheckCircle, AlertCircle, Camera } from "lucide-react"
import { formatDate, getStatusColor, getChecklistStatusLabel, isOverdue } from "@/lib/utils"
import { ChecklistRunWithDetails, Profile } from "@/types/database"

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<ChecklistRunWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Сессия истекла, войдите снова")
        return
      }
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("*, branch:branches!fk_profiles_branch(*)")
        .eq("id", user.id)
        .single()
      
      if (!profile) {
        toast.error("Профиль не найден")
        return
      }
      setCurrentUser(profile)
      
      // Fetch checklists for user's branch
      const { data: checklistsData } = await supabase
        .from("checklist_runs")
        .select(`
          *,
          checklist:checklists(title, type),
          branch:branches(name)
        `)
        .order("due_date", { ascending: true })

      // Батчинг: 2 запроса вместо N*2
      const runIds = (checklistsData || []).map(r => r.id)
      const checklistIds = [...new Set((checklistsData || []).map(r => r.checklist_id))]
      const { data: allItems } = checklistIds.length
        ? await supabase.from("checklist_items").select("*").in("checklist_id", checklistIds).order("order", { ascending: true })
        : { data: [] }
      const { data: allRunItems } = runIds.length
        ? await supabase.from("checklist_run_items").select("*").in("run_id", runIds)
        : { data: [] }

      const itemsByChecklist = new Map<string, typeof allItems>()
      for (const it of (allItems || [])) {
        const arr = itemsByChecklist.get(it.checklist_id) || []
        arr.push(it)
        itemsByChecklist.set(it.checklist_id, arr)
      }
      type RunItem = NonNullable<typeof allRunItems>[number]
      const runItemsByRun = new Map<string, Map<string, RunItem>>()
      for (const ri of (allRunItems || [])) {
        if (!runItemsByRun.has(ri.run_id)) runItemsByRun.set(ri.run_id, new Map())
        runItemsByRun.get(ri.run_id)!.set(ri.item_id, ri)
      }

      const checklistsWithItems = (checklistsData || []).map((checklist) => {
        const items = itemsByChecklist.get(checklist.checklist_id) || []
        const runMap = runItemsByRun.get(checklist.id) || new Map()
        return {
          ...checklist,
          items: items.map(item => ({ ...item, runItem: runMap.get(item.id) })),
          total_items: items.length,
          completed_items: items.filter(i => runMap.get(i.id)?.checked).length,
          is_overdue: isOverdue(checklist.due_date, checklist.status),
        }
      })
      
      setChecklists(checklistsWithItems)
    } catch (error) {
      console.error("Error fetching checklists:", error)
      toast.error("Ошибка загрузки чек-листов")
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
              const updatedRunItem = item.runItem
                ? { ...item.runItem, checked }
                : {
                    id: crypto.randomUUID(),
                    run_id: runId,
                    item_id: itemId,
                    checked,
                    updated_at: new Date().toISOString(),
                  }
              return { ...item, runItem: updatedRunItem }
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
    const completedItems = checklist.completed_items || 0
    const totalItems = checklist.total_items || 0
    const progress = totalItems
      ? Math.round((completedItems / totalItems) * 100)
      : 0
    
    return (
      <Card className={`min-w-0 ${checklist.is_overdue ? "border-red-200" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg line-clamp-2 break-words">{checklist.checklist?.title}</CardTitle>
              <CardDescription className="truncate">
                {checklist.branch?.name} • Срок: {formatDate(checklist.due_date)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm break-words ${item.runItem?.checked ? "line-through text-muted-foreground" : ""}`}>
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
      {loading && checklists.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Загрузка чек-листов...</CardContent></Card>
      )}
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
