"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"
import { Plus, Search, ArrowLeft, Edit, Mail, Building2 } from "lucide-react"
import { Profile, UserRole, Branch } from "@/types/database"
import { Database } from "@/types/supabase"
import { getRoleLabel } from "@/lib/utils"

const roles: UserRole[] = [
  "agent",
  "branch_manager",
  "ops_manager",
  "director",
  "security",
  "accountant",
  "it_admin",
  "hr",
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [creating, setCreating] = useState(false)
  const [createdCredential, setCreatedCredential] = useState<{
    id: string
    email: string
    temporary_password: string
  } | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "agent" as UserRole,
    branch_id: "",
  })

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("*, branch:branches!fk_profiles_branch(name)")
        .order("full_name")

      if (usersError) throw usersError
      setUsers((usersData || []) as unknown as Profile[])
      
      const { data: branchesData } = await supabase
        .from("branches")
        .select("*")
        .eq("is_active", true)
        .order("name")
      
      setBranches(branchesData || [])
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Ошибка загрузки пользователей")
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreate = async () => {
    if (creating || createdCredential) return
    try {
      setCreating(true)
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() ? formData.phone.trim() : undefined,
          role: formData.role,
          branch_id: formData.branch_id ? formData.branch_id : null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          (data && data.error) || "Ошибка при создании пользователя"
        )
      }
      setCreatedCredential({
        id: data.user.id,
        email: formData.email.trim(),
        temporary_password: data.temporary_password,
      })
      toast.success("Пользователь создан")
      fetchData()
    } catch (error: unknown) {
      console.error("Error creating user:", error)
      toast.error(error instanceof Error ? error.message : "Ошибка при создании пользователя")
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingUser) return

    try {
      const updatePayload = {
        full_name: formData.full_name,
        phone: formData.phone,
        role: formData.role,
        branch_id: formData.branch_id || null,
      }
      
      const { error } = await supabase
        .from("profiles")
        .update(updatePayload as never)
        .eq("id", editingUser.id)

      if (error) throw error

      toast.success("Пользователь обновлен")
      setEditingUser(null)
      fetchData()
    } catch (error) {
      console.error("Error updating user:", error)
      toast.error("Ошибка при обновлении")
    }
  }

  const handleDeactivate = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: false } as never)
        .eq("id", userId)

      if (error) throw error

      toast.success("Пользователь деактивирован")
      fetchData()
    } catch (error) {
      console.error("Error deactivating user:", error)
      toast.error("Ошибка при деактивации")
    }
  }

  const openEditDialog = (user: Profile) => {
    setEditingUser(user)
    setFormData({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      branch_id: user.branch_id || "",
    })
    setIsDialogOpen(true)
  }

  const openCreateDialog = () => {
    setEditingUser(null)
    setCreatedCredential(null)
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      role: "agent",
      branch_id: "",
    })
    setIsDialogOpen(true)
  }

  const filteredUsers = users.filter(u =>
    (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" aria-label="Назначение в админку">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Пользователи</h1>
            <p className="text-muted-foreground">Управление сотрудниками</p>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Новый пользователь
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск пользователей..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Список пользователей</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {(user.full_name || '').split(" ").map(n => n[0]).join("").toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{user.full_name}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </span>
                      {(user as Profile & { branch?: { name?: string } }).branch?.name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {(user as Profile & { branch?: { name?: string } }).branch?.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={user.is_active ? "default" : "secondary"}>
                    {getRoleLabel(user.role)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(user)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open && creating) return
          setIsDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Редактировать пользователя" : "Новый пользователь"}
            </DialogTitle>
            <DialogDescription>
              {editingUser 
                ? "Измените данные пользователя" 
                : "Создайте новую учетную запись"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ФИО</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Иванов Иван Иванович"
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@company.com"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+7 (999) 999-99-99"
              />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v as UserRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Точка</Label>
              <Select
                value={formData.branch_id || "office"}
                onValueChange={(v) =>
                  setFormData({ ...formData, branch_id: v === "office" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите точку" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="office">Центральный офис</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editingUser && createdCredential && (
              <div className="space-y-2 rounded-lg border p-3">
                <Label htmlFor="temporary-password">Временный пароль</Label>
                <Input
                  id="temporary-password"
                  readOnly
                  value={createdCredential.temporary_password}
                />
                <p className="text-sm text-muted-foreground">
                  Передайте временный пароль пользователю {createdCredential.email} вручную.
                  Пароль показан один раз.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            {!editingUser && createdCredential ? (
              <>
                <Button
                  variant="outline"
                  disabled={creating}
                  onClick={() => setIsDialogOpen(false)}
                >
                  Закрыть
                </Button>
                <Button onClick={() => setIsDialogOpen(false)}>
                  Готово
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={creating}
                  onClick={() => setIsDialogOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  onClick={editingUser ? handleUpdate : handleCreate}
                  disabled={!editingUser && (creating || !!createdCredential)}
                >
                  {editingUser ? "Сохранить" : creating ? "Создание..." : "Создать"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
