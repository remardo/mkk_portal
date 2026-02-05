export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          role: 'agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr'
          branch_id: string | null
          is_active: boolean
          hired_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          phone?: string | null
          role?: 'agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr'
          branch_id?: string | null
          is_active?: boolean
          hired_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          phone?: string | null
          role?: 'agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr'
          branch_id?: string | null
          is_active?: boolean
          hired_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      branches: {
        Row: {
          id: string
          name: string
          city: string
          address: string
          phone: string | null
          working_hours: string | null
          region: string | null
          ops_manager_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          city: string
          address: string
          phone?: string | null
          working_hours?: string | null
          region?: string | null
          ops_manager_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          city?: string
          address?: string
          phone?: string | null
          working_hours?: string | null
          region?: string | null
          ops_manager_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      knowledge_categories: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          order?: number
          created_at?: string
          updated_at?: string
        }
      }
      knowledge_articles: {
        Row: {
          id: string
          category_id: string | null
          title: string
          content: string
          tags: string[]
          status: 'draft' | 'published' | 'archived'
          visibility_roles: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids: string[]
          views: number
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id?: string | null
          title: string
          content: string
          tags?: string[]
          status?: 'draft' | 'published' | 'archived'
          visibility_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids?: string[]
          views?: number
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string | null
          title?: string
          content?: string
          tags?: string[]
          status?: 'draft' | 'published' | 'archived'
          visibility_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids?: string[]
          views?: number
          created_by?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      document_categories: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          category_id: string | null
          title: string
          description: string | null
          file_path: string
          version: string
          effective_from: string | null
          mandatory: boolean
          visibility_roles: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids: string[]
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id?: string | null
          title: string
          description?: string | null
          file_path: string
          version?: string
          effective_from?: string | null
          mandatory?: boolean
          visibility_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids?: string[]
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string | null
          title?: string
          description?: string | null
          file_path?: string
          version?: string
          effective_from?: string | null
          mandatory?: boolean
          visibility_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids?: string[]
          created_by?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      document_acknowledgements: {
        Row: {
          id: string
          document_id: string
          user_id: string
          acknowledged_at: string
        }
        Insert: {
          id?: string
          document_id: string
          user_id: string
          acknowledged_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          user_id?: string
          acknowledged_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          title: string
          description: string | null
          mandatory: boolean
          period_days: number | null
          visibility_roles: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids: string[]
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          mandatory?: boolean
          period_days?: number | null
          visibility_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids?: string[]
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          mandatory?: boolean
          period_days?: number | null
          visibility_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids?: string[]
          created_by?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      course_lessons: {
        Row: {
          id: string
          course_id: string
          title: string
          content: string
          order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          content: string
          order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          content?: string
          order?: number
          created_at?: string
          updated_at?: string
        }
      }
      course_progress: {
        Row: {
          id: string
          course_id: string
          user_id: string
          status: 'not_started' | 'in_progress' | 'completed'
          last_lesson_id: string | null
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          user_id: string
          status?: 'not_started' | 'in_progress' | 'completed'
          last_lesson_id?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          user_id?: string
          status?: 'not_started' | 'in_progress' | 'completed'
          last_lesson_id?: string | null
          completed_at?: string | null
          updated_at?: string
        }
      }
      tests: {
        Row: {
          id: string
          title: string
          description: string | null
          course_id: string | null
          mandatory: boolean
          pass_score: number
          max_attempts: number | null
          time_limit_minutes: number | null
          visibility_roles: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids: string[]
          period_days: number | null
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          course_id?: string | null
          mandatory?: boolean
          pass_score?: number
          max_attempts?: number | null
          time_limit_minutes?: number | null
          visibility_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids?: string[]
          period_days?: number | null
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          course_id?: string | null
          mandatory?: boolean
          pass_score?: number
          max_attempts?: number | null
          time_limit_minutes?: number | null
          visibility_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids?: string[]
          period_days?: number | null
          created_by?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      test_questions: {
        Row: {
          id: string
          test_id: string
          question_text: string
          type: 'single_choice' | 'multiple_choice' | 'text'
          order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          test_id: string
          question_text: string
          type?: 'single_choice' | 'multiple_choice' | 'text'
          order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          test_id?: string
          question_text?: string
          type?: 'single_choice' | 'multiple_choice' | 'text'
          order?: number
          created_at?: string
          updated_at?: string
        }
      }
      test_answer_options: {
        Row: {
          id: string
          question_id: string
          text: string
          is_correct: boolean
          order: number
        }
        Insert: {
          id?: string
          question_id: string
          text: string
          is_correct?: boolean
          order?: number
        }
        Update: {
          id?: string
          question_id?: string
          text?: string
          is_correct?: boolean
          order?: number
        }
      }
      test_attempts: {
        Row: {
          id: string
          test_id: string
          user_id: string
          started_at: string
          finished_at: string | null
          score: number | null
          passed: boolean | null
          status: 'in_progress' | 'completed' | 'expired'
        }
        Insert: {
          id?: string
          test_id: string
          user_id: string
          started_at?: string
          finished_at?: string | null
          score?: number | null
          passed?: boolean | null
          status?: 'in_progress' | 'completed' | 'expired'
        }
        Update: {
          id?: string
          test_id?: string
          user_id?: string
          started_at?: string
          finished_at?: string | null
          score?: number | null
          passed?: boolean | null
          status?: 'in_progress' | 'completed' | 'expired'
        }
      }
      test_attempt_answers: {
        Row: {
          id: string
          attempt_id: string
          question_id: string
          selected_option_ids: string[]
          text_answer: string | null
          is_correct: boolean | null
        }
        Insert: {
          id?: string
          attempt_id: string
          question_id: string
          selected_option_ids?: string[]
          text_answer?: string | null
          is_correct?: boolean | null
        }
        Update: {
          id?: string
          attempt_id?: string
          question_id?: string
          selected_option_ids?: string[]
          text_answer?: string | null
          is_correct?: boolean | null
        }
      }
      checklists: {
        Row: {
          id: string
          title: string
          description: string | null
          type: 'daily' | 'weekly' | 'monthly' | 'once' | 'by_event'
          applicable_branch_ids: string[]
          applicable_roles: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          type?: 'daily' | 'weekly' | 'monthly' | 'once' | 'by_event'
          applicable_branch_ids?: string[]
          applicable_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          type?: 'daily' | 'weekly' | 'monthly' | 'once' | 'by_event'
          applicable_branch_ids?: string[]
          applicable_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          created_by?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      checklist_items: {
        Row: {
          id: string
          checklist_id: string
          title: string
          type: 'checkbox' | 'text' | 'photo'
          required: boolean
          order: number
        }
        Insert: {
          id?: string
          checklist_id: string
          title: string
          type?: 'checkbox' | 'text' | 'photo'
          required?: boolean
          order?: number
        }
        Update: {
          id?: string
          checklist_id?: string
          title?: string
          type?: 'checkbox' | 'text' | 'photo'
          required?: boolean
          order?: number
        }
      }
      checklist_runs: {
        Row: {
          id: string
          checklist_id: string
          branch_id: string
          due_date: string
          status: 'not_started' | 'in_progress' | 'completed' | 'overdue'
          created_by: string
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          checklist_id: string
          branch_id: string
          due_date: string
          status?: 'not_started' | 'in_progress' | 'completed' | 'overdue'
          created_by: string
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          checklist_id?: string
          branch_id?: string
          due_date?: string
          status?: 'not_started' | 'in_progress' | 'completed' | 'overdue'
          created_by?: string
          completed_at?: string | null
          created_at?: string
        }
      }
      checklist_run_items: {
        Row: {
          id: string
          run_id: string
          item_id: string
          checked: boolean
          text_value: string | null
          photo_path: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          run_id: string
          item_id: string
          checked?: boolean
          text_value?: string | null
          photo_path?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          run_id?: string
          item_id?: string
          checked?: boolean
          text_value?: string | null
          photo_path?: string | null
          updated_by?: string | null
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          type: 'operations' | 'it' | 'security' | 'other'
          priority: 'low' | 'medium' | 'high'
          status: 'new' | 'in_progress' | 'done' | 'rejected'
          author_id: string
          assignee_id: string | null
          branch_id: string | null
          due_date: string | null
          created_at: string
          updated_at: string
          closed_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          type?: 'operations' | 'it' | 'security' | 'other'
          priority?: 'low' | 'medium' | 'high'
          status?: 'new' | 'in_progress' | 'done' | 'rejected'
          author_id: string
          assignee_id?: string | null
          branch_id?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
          closed_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          type?: 'operations' | 'it' | 'security' | 'other'
          priority?: 'low' | 'medium' | 'high'
          status?: 'new' | 'in_progress' | 'done' | 'rejected'
          author_id?: string
          assignee_id?: string | null
          branch_id?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
          closed_at?: string | null
        }
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          author_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          author_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          author_id?: string
          content?: string
          created_at?: string
        }
      }
      task_attachments: {
        Row: {
          id: string
          task_id: string
          file_path: string
          uploaded_by: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          task_id: string
          file_path: string
          uploaded_by: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          file_path?: string
          uploaded_by?: string
          uploaded_at?: string
        }
      }
      news: {
        Row: {
          id: string
          title: string
          content: string
          type: 'critical' | 'normal'
          audience_roles: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          audience_branch_ids: string[]
          published_at: string | null
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          type?: 'critical' | 'normal'
          audience_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          audience_branch_ids?: string[]
          published_at?: string | null
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          type?: 'critical' | 'normal'
          audience_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          audience_branch_ids?: string[]
          published_at?: string | null
          created_by?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      news_reads: {
        Row: {
          id: string
          news_id: string
          user_id: string
          read_at: string
        }
        Insert: {
          id?: string
          news_id: string
          user_id: string
          read_at?: string
        }
        Update: {
          id?: string
          news_id?: string
          user_id?: string
          read_at?: string
        }
      }
      chat_channels: {
        Row: {
          id: string
          name: string
          code: string | null
          visibility_roles: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          code?: string | null
          visibility_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string | null
          visibility_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          channel_id: string
          author_id: string
          content: string
          file_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          author_id: string
          content: string
          file_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          channel_id?: string
          author_id?: string
          content?: string
          file_path?: string | null
          created_at?: string
        }
      }
      ai_index: {
        Row: {
          id: string
          source_type: string
          source_id: string
          chunk_index: number
          content: string
          embedding: string | null
          visibility_roles: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_type: string
          source_id: string
          chunk_index?: number
          content: string
          embedding?: string | null
          visibility_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          source_type?: string
          source_id?: string
          chunk_index?: number
          content?: string
          embedding?: string | null
          visibility_roles?: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[]
          visibility_branch_ids?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          table_name: string | null
          record_id: string | null
          old_data: Json | null
          new_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          table_name?: string | null
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          table_name?: string | null
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
      }
      system_settings: {
        Row: {
          key: string
          value: string
          description: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          description?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          description?: string | null
          updated_by?: string | null
          updated_at?: string
        }
      }
    }
    Views: {
      v_company_stats: {
        Row: {
          active_employees: number | null
          active_branches: number | null
          open_tasks: number | null
          overdue_checklists: number | null
          critical_news_30d: number | null
        }
      }
      v_branch_stats: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          city: string | null
          region: string | null
          employee_count: number | null
          active_employees: number | null
          open_tasks: number | null
          overdue_checklists: number | null
          completed_checklists_7d: number | null
          ops_manager_name: string | null
        }
      }
      v_employee_learning_stats: {
        Row: {
          user_id: string | null
          full_name: string | null
          role: 'agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr' | null
          branch_name: string | null
          mandatory_courses_total: number | null
          mandatory_courses_completed: number | null
          mandatory_tests_total: number | null
          mandatory_tests_passed: number | null
          last_certification_date: string | null
          certifications_actual: boolean | null
        }
      }
      v_document_acknowledgement_stats: {
        Row: {
          document_id: string | null
          document_title: string | null
          version: string | null
          effective_from: string | null
          mandatory: boolean | null
          total_employees: number | null
          acknowledged_count: number | null
          acknowledgement_percent: number | null
          not_acknowledged_employees: string[] | null
        }
      }
      v_tasks_by_type_stats: {
        Row: {
          type: 'operations' | 'it' | 'security' | 'other' | null
          priority: 'low' | 'medium' | 'high' | null
          status: 'new' | 'in_progress' | 'done' | 'rejected' | null
          count: number | null
          avg_resolution_hours: number | null
          overdue_count: number | null
        }
      }
      v_portal_activity: {
        Row: {
          date: string | null
          activity_type: string | null
          count: number | null
          total_daily: number | null
        }
      }
      v_my_tasks: {
        Row: {
          id: string | null
          title: string | null
          description: string | null
          type: 'operations' | 'it' | 'security' | 'other' | null
          priority: 'low' | 'medium' | 'high' | null
          status: 'new' | 'in_progress' | 'done' | 'rejected' | null
          author_id: string | null
          assignee_id: string | null
          branch_id: string | null
          due_date: string | null
          created_at: string | null
          author_name: string | null
          assignee_name: string | null
          branch_name: string | null
          is_overdue: boolean | null
        }
      }
      v_my_checklists: {
        Row: {
          id: string | null
          checklist_id: string | null
          branch_id: string | null
          due_date: string | null
          status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | null
          created_by: string | null
          completed_at: string | null
          created_at: string | null
          checklist_title: string | null
          checklist_type: 'daily' | 'weekly' | 'monthly' | 'once' | 'by_event' | null
          branch_name: string | null
          total_items: number | null
          completed_items: number | null
          is_overdue: boolean | null
        }
      }
      v_test_results_detailed: {
        Row: {
          attempt_id: string | null
          test_id: string | null
          test_title: string | null
          mandatory: boolean | null
          pass_score: number | null
          user_id: string | null
          full_name: string | null
          branch_name: string | null
          started_at: string | null
          finished_at: string | null
          score: number | null
          passed: boolean | null
          status: 'in_progress' | 'completed' | 'expired' | null
          duration_minutes: number | null
          total_questions: number | null
          correct_answers: number | null
        }
      }
      v_news_read_stats: {
        Row: {
          news_id: string | null
          title: string | null
          type: 'critical' | 'normal' | null
          published_at: string | null
          read_count: number | null
          total_employees: number | null
          read_percent: number | null
        }
      }
      v_it_stats: {
        Row: {
          week: string | null
          total_tasks: number | null
          completed_tasks: number | null
          avg_resolution_hours: number | null
          high_priority_tasks: number | null
          high_priority_completed: number | null
        }
      }
      v_course_progress_detailed: {
        Row: {
          course_id: string | null
          course_title: string | null
          mandatory: boolean | null
          user_id: string | null
          full_name: string | null
          branch_name: string | null
          status: 'not_started' | 'in_progress' | 'completed' | null
          last_activity: string | null
          total_lessons: number | null
          completed_lessons: number | null
          progress_percent: number | null
        }
      }
      v_director_dashboard: {
        Row: {
          total_employees: number | null
          total_branches: number | null
          employees_with_actual_certifications: number | null
          total_active_employees: number | null
          certification_compliance_percent: number | null
          checklists_completed_7d: number | null
          checklists_overdue: number | null
          open_tasks: number | null
          overdue_tasks: number | null
          open_it_tasks: number | null
          open_operations_tasks: number | null
          tests_completed_7d: number | null
          documents_acknowledged_7d: number | null
        }
      }
      v_ops_manager_dashboard: {
        Row: {
          ops_manager_id: string | null
          ops_manager_name: string | null
          managed_branches: number | null
          total_employees: number | null
          overdue_checklists: number | null
          completed_checklists_7d: number | null
          open_tasks: number | null
          overdue_tasks: number | null
          employees_with_expired_certifications: number | null
        }
      }
      v_unread_news: {
        Row: {
          id: string | null
          title: string | null
          content: string | null
          type: 'critical' | 'normal' | null
          audience_roles: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[] | null
          audience_branch_ids: string[] | null
          published_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string | null
          updated_at: string | null
          current_user_id: string | null
        }
      }
    }
    Functions: {
      get_director_dashboard: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_employees: number
          total_branches: number
          employees_with_actual_certifications: number
          total_active_employees: number
          certification_compliance_percent: number
          checklists_completed_7d: number
          checklists_overdue: number
          open_tasks: number
          overdue_tasks: number
          open_it_tasks: number
          open_operations_tasks: number
          tests_completed_7d: number
          documents_acknowledged_7d: number
        }[]
      }
      get_ops_manager_dashboard: {
        Args: { manager_id: string }
        Returns: {
          ops_manager_id: string
          ops_manager_name: string
          managed_branches: number
          total_employees: number
          overdue_checklists: number
          completed_checklists_7d: number
          open_tasks: number
          overdue_tasks: number
          employees_with_expired_certifications: number
        }[]
      }
      get_my_tasks: {
        Args: { user_id: string; limit_count?: number }
        Returns: {
          id: string
          title: string
          description: string
          type: 'operations' | 'it' | 'security' | 'other'
          priority: 'low' | 'medium' | 'high'
          status: 'new' | 'in_progress' | 'done' | 'rejected'
          author_id: string
          assignee_id: string
          branch_id: string
          due_date: string
          created_at: string
          author_name: string
          assignee_name: string
          branch_name: string
          is_overdue: boolean
        }[]
      }
      get_my_checklists: {
        Args: { user_branch_id: string; limit_count?: number }
        Returns: {
          id: string
          checklist_id: string
          branch_id: string
          due_date: string
          status: 'not_started' | 'in_progress' | 'completed' | 'overdue'
          created_by: string
          completed_at: string
          created_at: string
          checklist_title: string
          checklist_type: 'daily' | 'weekly' | 'monthly' | 'once' | 'by_event'
          branch_name: string
          total_items: number
          completed_items: number
          is_overdue: boolean
        }[]
      }
      search_knowledge: {
        Args: { search_query: string }
        Returns: {
          id: string
          title: string
          content: string
          category_name: string
          rank: number
        }[]
      }
      increment_article_views: {
        Args: { article_id: string }
        Returns: undefined
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: 'agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr'
      }
      get_current_user_branch: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_ops_manager_for_branch: {
        Args: { branch_uuid: string }
        Returns: boolean
      }
      is_visible_by_roles: {
        Args: { allowed_roles: ('agent' | 'branch_manager' | 'ops_manager' | 'director' | 'security' | 'accountant' | 'it_admin' | 'hr')[] }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
