import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000)

  if (diffInSeconds < 60) return 'только что'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} мин. назад`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ч. назад`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} дн. назад`
  
  return formatDate(date)
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    agent: 'Сотрудник точки',
    branch_manager: 'Старший точки',
    ops_manager: 'Операционный руководитель',
    director: 'Директор',
    security: 'Безопасность',
    accountant: 'Бухгалтерия',
    it_admin: 'IT-администратор',
    hr: 'HR',
  }
  return labels[role] || role
}

export function getTaskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    operations: 'Операционная',
    it: 'IT',
    security: 'Безопасность',
    other: 'Другое',
  }
  return labels[type] || type
}

export function getTaskPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
  }
  return labels[priority] || priority
}

export function getTaskStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: 'Новая',
    in_progress: 'В работе',
    done: 'Выполнена',
    rejected: 'Отклонена',
  }
  return labels[status] || status
}

export function getChecklistStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_started: 'Не начат',
    in_progress: 'В процессе',
    completed: 'Выполнен',
    overdue: 'Просрочен',
  }
  return labels[status] || status
}

export function getNewsTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    critical: 'Критичная',
    normal: 'Обычная',
  }
  return labels[type] || type
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'bg-slate-100 text-slate-800',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-red-100 text-red-800',
  }
  return colors[priority] || 'bg-slate-100 text-slate-800'
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-amber-100 text-amber-800',
    done: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    not_started: 'bg-slate-100 text-slate-800',
    completed: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    published: 'bg-green-100 text-green-800',
    draft: 'bg-slate-100 text-slate-800',
    archived: 'bg-gray-100 text-gray-800',
  }
  return colors[status] || 'bg-slate-100 text-slate-800'
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function generateInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function isOverdue(dueDate: string | Date | null | undefined, status?: string): boolean {
  if (!dueDate) return false
  if (status && ['done', 'completed', 'rejected'].includes(status)) return false
  return new Date(dueDate) < new Date()
}
