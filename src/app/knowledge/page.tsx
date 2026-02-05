"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { Search, BookOpen, Eye, Folder, Tag, ChevronRight } from "lucide-react"
import { formatDate, truncateText } from "@/lib/utils"
import { KnowledgeArticleWithCategory, KnowledgeCategory } from "@/types/database"

export default function KnowledgePage() {
  const [articles, setArticles] = useState<KnowledgeArticleWithCategory[]>([])
  const [categories, setCategories] = useState<KnowledgeCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch categories
      const { data: categoriesData } = await supabase
        .from("knowledge_categories")
        .select("*")
        .order("order", { ascending: true })
      
      setCategories(categoriesData || [])
      
      // Fetch articles
      const { data: articlesData } = await supabase
        .from("knowledge_articles")
        .select("*, category:knowledge_categories(*), created_by_profile:profiles(full_name)")
        .eq("status", "published")
        .order("created_at", { ascending: false })
      
      setArticles(articlesData || [])
    } catch (error) {
      console.error("Error fetching knowledge data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchData()
      return
    }
    
    try {
      setLoading(true)
      const { data } = await supabase
        .rpc("search_knowledge", { search_query: searchQuery })
      
      if (data) {
        // Fetch full article data for search results
        const articleIds = data.map((r: any) => r.id)
        const { data: fullArticles } = await supabase
          .from("knowledge_articles")
          .select("*, category:knowledge_categories(*), created_by_profile:profiles(full_name)")
          .in("id", articleIds)
        
        setArticles(fullArticles || [])
      }
    } catch (error) {
      console.error("Error searching:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredArticles = selectedCategory
    ? articles.filter(a => a.category_id === selectedCategory)
    : articles

  const articlesByCategory = categories.map(cat => ({
    ...cat,
    articles: filteredArticles.filter(a => a.category_id === cat.id),
  })).filter(cat => cat.articles.length > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">База знаний</h1>
          <p className="text-muted-foreground mt-1">
            Статьи, инструкции и полезная информация
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по базе знаний..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>Найти</Button>
            {searchQuery && (
              <Button variant="ghost" onClick={() => { setSearchQuery(""); fetchData() }}>
                Сбросить
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      {!searchQuery && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            Все
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </Button>
          ))}
        </div>
      )}

      {/* Articles */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {articlesByCategory.length > 0 ? (
            articlesByCategory.map((category) => (
              <div key={category.id}>
                <div className="flex items-center gap-2 mb-4">
                  <Folder className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">{category.name}</h2>
                  <Badge variant="secondary">{category.articles.length}</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {category.articles.map((article) => (
                    <Link key={article.id} href={`/knowledge/${article.id}`}>
                      <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{article.title}</CardTitle>
                          <CardDescription>
                            {truncateText(article.content, 120)}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <Eye className="h-4 w-4" />
                                {article.views}
                              </span>
                              <span>{formatDate(article.created_at)}</span>
                            </div>
                            {article.tags && article.tags.length > 0 && (
                              <div className="flex gap-1">
                                {article.tags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    <Tag className="h-3 w-3 mr-1" />
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
                <Separator className="mt-8" />
              </div>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? "По вашему запросу ничего не найдено"
                    : "В этой категории пока нет статей"
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
