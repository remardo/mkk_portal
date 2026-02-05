// ============================================
// Типы для Supabase Database
// ============================================

export type UserRole = 
  | 'agent'
  | 'branch_manager'
  | 'ops_manager'
  | 'director'
  | 'security'
  | 'accountant'
  | 'it_admin'
  | 'hr';

export type ChecklistType = 'daily' | 'weekly' | 'monthly' | 'once' | 'by_event';
export type TaskType = 'operations' | 'it' | 'security' | 'other';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'new' | 'in_progress' | 'done' | 'rejected';
export type ChecklistStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';
export type QuestionType = 'single_choice' | 'multiple_choice' | 'text';
export type ChecklistItemType = 'checkbox' | 'text' | 'photo';
export type NewsType = 'critical' | 'normal';
export type ArticleStatus = 'draft' | 'published' | 'archived';
export type CourseProgressStatus = 'not_started' | 'in_progress' | 'completed';
export type TestAttemptStatus = 'in_progress' | 'completed' | 'expired';

// --------------------------------------------
// Профили
// --------------------------------------------
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  branch_id?: string;
  is_active: boolean;
  hired_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileWithBranch extends Profile {
  branch?: Branch;
}

// --------------------------------------------
// Точки выдачи
// --------------------------------------------
export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
  phone?: string;
  working_hours?: string;
  region?: string;
  ops_manager_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchWithManager extends Branch {
  ops_manager?: Profile;
}

// --------------------------------------------
// База знаний
// --------------------------------------------
export interface KnowledgeCategory {
  id: string;
  name: string;
  parent_id?: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeArticle {
  id: string;
  category_id?: string;
  title: string;
  content: string;
  tags: string[];
  status: ArticleStatus;
  visibility_roles: UserRole[];
  visibility_branch_ids: string[];
  views: number;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeArticleWithCategory extends KnowledgeArticle {
  category?: KnowledgeCategory;
  created_by_profile?: Profile;
}

// --------------------------------------------
// Документы
// --------------------------------------------
export interface DocumentCategory {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  category_id?: string;
  title: string;
  description?: string;
  file_path: string;
  version: string;
  effective_from?: string;
  mandatory: boolean;
  visibility_roles: UserRole[];
  visibility_branch_ids: string[];
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentWithCategory extends Document {
  category?: DocumentCategory;
  is_acknowledged?: boolean;
  acknowledged_at?: string;
}

export interface DocumentAcknowledgement {
  id: string;
  document_id: string;
  user_id: string;
  acknowledged_at: string;
}

// --------------------------------------------
// Обучение
// --------------------------------------------
export interface Course {
  id: string;
  title: string;
  description?: string;
  mandatory: boolean;
  period_days?: number;
  visibility_roles: UserRole[];
  visibility_branch_ids: string[];
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CourseLesson {
  id: string;
  course_id: string;
  title: string;
  content: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface CourseProgress {
  id: string;
  course_id: string;
  user_id: string;
  status: CourseProgressStatus;
  last_lesson_id?: string;
  completed_at?: string;
  updated_at: string;
}

export interface CourseWithProgress extends Course {
  lessons?: CourseLesson[];
  progress?: CourseProgress;
  progress_percent?: number;
}

// --------------------------------------------
// Тесты
// --------------------------------------------
export interface Test {
  id: string;
  title: string;
  description?: string;
  course_id?: string;
  mandatory: boolean;
  pass_score: number;
  max_attempts?: number;
  time_limit_minutes?: number;
  visibility_roles: UserRole[];
  visibility_branch_ids: string[];
  period_days?: number;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TestQuestion {
  id: string;
  test_id: string;
  question_text: string;
  type: QuestionType;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface TestAnswerOption {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  order: number;
}

export interface TestAttempt {
  id: string;
  test_id: string;
  user_id: string;
  started_at: string;
  finished_at?: string;
  score?: number;
  passed?: boolean;
  status: TestAttemptStatus;
}

export interface TestAttemptAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_ids: string[];
  text_answer?: string;
  is_correct?: boolean;
}

export interface TestWithQuestions extends Test {
  questions?: (TestQuestion & { options?: TestAnswerOption[] })[];
}

// --------------------------------------------
// Чек-листы
// --------------------------------------------
export interface Checklist {
  id: string;
  title: string;
  description?: string;
  type: ChecklistType;
  applicable_branch_ids: string[];
  applicable_roles: UserRole[];
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  title: string;
  type: ChecklistItemType;
  required: boolean;
  order: number;
}

export interface ChecklistRun {
  id: string;
  checklist_id: string;
  branch_id: string;
  due_date: string;
  status: ChecklistStatus;
  created_by: string;
  completed_at?: string;
  created_at: string;
}

export interface ChecklistRunItem {
  id: string;
  run_id: string;
  item_id: string;
  checked: boolean;
  text_value?: string;
  photo_path?: string;
  updated_by?: string;
  updated_at: string;
}

export interface ChecklistRunWithDetails extends ChecklistRun {
  checklist?: Checklist;
  branch?: Branch;
  items?: (ChecklistRunItem & { item?: ChecklistItem })[];
  total_items?: number;
  completed_items?: number;
  is_overdue?: boolean;
}

// --------------------------------------------
// Задачи
// --------------------------------------------
export interface Task {
  id: string;
  title: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  author_id: string;
  assignee_id?: string;
  branch_id?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_path: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface TaskWithDetails extends Task {
  author?: Profile;
  assignee?: Profile;
  branch?: Branch;
  comments?: (TaskComment & { author?: Profile })[];
  attachments?: TaskAttachment[];
  is_overdue?: boolean;
}

// --------------------------------------------
// Новости
// --------------------------------------------
export interface News {
  id: string;
  title: string;
  content: string;
  type: NewsType;
  audience_roles: UserRole[];
  audience_branch_ids: string[];
  published_at?: string;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface NewsRead {
  id: string;
  news_id: string;
  user_id: string;
  read_at: string;
}

export interface NewsWithRead extends News {
  is_read?: boolean;
  read_count?: number;
}

// --------------------------------------------
// Чат
// --------------------------------------------
export interface ChatChannel {
  id: string;
  name: string;
  code?: string;
  visibility_roles: UserRole[];
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  file_path?: string;
  created_at: string;
}

export interface ChatMessageWithAuthor extends ChatMessage {
  author?: Profile;
}

// --------------------------------------------
// ИИ-индекс
// --------------------------------------------
export interface AIIndex {
  id: string;
  source_type: string;
  source_id: string;
  chunk_index: number;
  content: string;
  embedding?: number[];
  visibility_roles: UserRole[];
  visibility_branch_ids: string[];
  created_at: string;
  updated_at: string;
}

// --------------------------------------------
// Настройки системы
// --------------------------------------------
export interface SystemSetting {
  key: string;
  value: string;
  description?: string;
  updated_by?: string;
  updated_at: string;
}

// --------------------------------------------
// Dashboard типы
// --------------------------------------------
export interface DirectorDashboardStats {
  total_employees: number;
  total_branches: number;
  employees_with_actual_certifications: number;
  total_active_employees: number;
  certification_compliance_percent: number;
  checklists_completed_7d: number;
  checklists_overdue: number;
  open_tasks: number;
  overdue_tasks: number;
  open_it_tasks: number;
  open_operations_tasks: number;
  tests_completed_7d: number;
  documents_acknowledged_7d: number;
}

export interface OpsManagerDashboardStats {
  ops_manager_id: string;
  ops_manager_name: string;
  managed_branches: number;
  total_employees: number;
  overdue_checklists: number;
  completed_checklists_7d: number;
  open_tasks: number;
  overdue_tasks: number;
  employees_with_expired_certifications: number;
}
