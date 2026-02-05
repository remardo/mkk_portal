"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArrowLeft, Eye, Calendar, User, Tag, Edit } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { KnowledgeArticleWithCategory } from "@/types/database"

export default function ArticlePage() {
  const params = useParams()
  const [article, setArticle] = useState<KnowledgeArticleWithCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchArticle()
    checkAdmin()
  }, [params.id])

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
      
      setIsAdmin(profile?.role === "it_admin" || profile?.role === "director")
    }
  }

  const fetchArticle = async () => {
    try {
      setLoading(true)
      
      const { data } = await supabase
        .from("knowledge_articles")
        .select("*, category:knowledge_categories(*), created_by_profile:profiles(full_name)")
        .eq("id", params.id)
        .single()
      
      if (data) {
        setArticle(data)
        // Increment views
        await supabase.rpc("increment_article_views", { article_id: params.id })
      }
    } catch (error) {
      console.error("Error fetching article:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!article) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Статья не найдена</p>
          <Link href="/knowledge">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад к базе знаний
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/knowledge">
        <Button variant="ghost" className="pl-0">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад к базе знаний
        </Button>
      </Link>

      {/* Article Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold">{article.title}</h1>
          {isAdmin && (
            <Link href={`/admin/knowledge/${article.id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Редактировать
              </Button>
            </Link>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
          {article.category && (
            <Badge variant="secondary">{article.category.name}</Badge>
          )}
          <span className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {article.created_by_profile?.full_name || "Неизвестно"}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(article.created_at)}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {article.views} просмотров
          </span>
        </div>

        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {article.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Article Content */}
      <Card>
        <CardContent className="pt-6">
          <div className="markdown-content prose max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {article.content}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
