"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import { ArrowLeft, FileText, CheckCircle, ExternalLink, Calendar } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { DocumentWithCategory } from "@/types/database"

export default function DocumentPage() {
  const params = useParams()
  const [doc, setDoc] = useState<DocumentWithCategory | null>(null)
  const [mdContent, setMdContent] = useState<string | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(true)
  const [loadingFile, setLoadingFile] = useState(false)
  const [isAcknowledged, setIsAcknowledged] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const isMarkdown = (p: string) => p.toLowerCase().endsWith(".md")

  const fetchDoc = useCallback(async () => {
    try {
      setLoadingDoc(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Сессия истекла, войдите снова")
        return
      }
      const { data, error } = await supabase
        .from("documents")
        .select("*, category:document_categories(*)")
        .eq("id", params.id)
        .single()
      if (error || !data) {
        toast.error("Документ не найден")
        return
      }
      setDoc(data)

      const { data: ack } = await supabase
        .from("document_acknowledgements")
        .select("document_id")
        .eq("document_id", params.id)
        .eq("user_id", user.id)
        .maybeSingle()
      setIsAcknowledged(!!ack)

      // Контент: сначала колонка content из БД, иначе md-файл из storage
      if (data.content) {
        setMdContent(data.content)
      } else if (isMarkdown(data.file_path)) {
        setLoadingFile(true)
        const { data: blob, error: dlError } = await supabase.storage
          .from("documents")
          .download(data.file_path)
        if (dlError || !blob) {
          console.error("Error downloading document:", dlError)
        } else {
          setMdContent(await blob.text())
        }
        setLoadingFile(false)
      }
    } catch (error) {
      console.error("Error fetching document:", error)
      toast.error("Ошибка загрузки документа")
    } finally {
      setLoadingDoc(false)
    }
  }, [supabase, params.id])

  useEffect(() => {
    fetchDoc()
  }, [fetchDoc])

  const handleAcknowledge = async () => {
    if (!doc) return
    try {
      setAcknowledging(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from("document_acknowledgements")
        .insert({ document_id: doc.id, user_id: user.id })
      if (error) throw error
      setIsAcknowledged(true)
      toast.success("Ознакомление подтверждено")
    } catch (error) {
      console.error("Error acknowledging document:", error)
      toast.error("Ошибка при подтверждении ознакомления")
    } finally {
      setAcknowledging(false)
    }
  }

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage.from("documents").getPublicUrl(filePath)
    return data.publicUrl
  }

  if (loadingDoc) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!doc) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Документ не найден</p>
          <Link href="/documents">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад к документам
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  const showMarkdown = isMarkdown(doc.file_path)

  return (
    <div className="space-y-6">
      <Link href="/documents">
        <Button variant="ghost" className="pl-0">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад к документам
        </Button>
      </Link>

      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-3xl font-bold break-words min-w-0">{doc.title}</h1>
          {doc.mandatory && (
            <Badge variant={isAcknowledged ? "default" : "destructive"}>
              {isAcknowledged ? "Ознакомлен" : "Обязателен"}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
          {doc.category && <Badge variant="secondary">{doc.category.name}</Badge>}
          <span>Версия {doc.version}</span>
          {doc.effective_from && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Действует с: {formatDate(doc.effective_from)}
            </span>
          )}
        </div>
        {doc.description && (
          <p className="text-muted-foreground mt-2">{doc.description}</p>
        )}
      </div>

      {doc.mandatory && !isAcknowledged && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-red-800 text-lg">Требуется ознакомление</CardTitle>
              <CardDescription className="text-red-700">
                Подтвердите, что ознакомились с документом
              </CardDescription>
            </div>
            <Button onClick={handleAcknowledge} disabled={acknowledging}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {acknowledging ? "..." : "Ознакомлен"}
            </Button>
          </CardHeader>
        </Card>
      )}

      <Separator />

      {showMarkdown ? (
        loadingFile ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : mdContent ? (
          <Card>
            <CardContent className="pt-6">
              <div className="markdown-content prose max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {mdContent}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Не удалось загрузить текст документа</p>
              <a href={getFileUrl(doc.file_path)} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="mt-4">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Открыть файл
                </Button>
              </a>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Предпросмотр недоступен для этого формата</p>
            <a href={getFileUrl(doc.file_path)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="mt-4">
                <ExternalLink className="h-4 w-4 mr-2" />
                Открыть файл
              </Button>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
