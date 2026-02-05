"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { FileText, Download, CheckCircle, AlertCircle, ExternalLink, Folder } from "lucide-react"
import { formatDate, getStatusColor } from "@/lib/utils"
import { DocumentWithCategory, DocumentCategory } from "@/types/database"

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentWithCategory[]>([])
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [acknowledgedDocs, setAcknowledgedDocs] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [acknowledging, setAcknowledging] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      // Fetch categories
      const { data: categoriesData } = await supabase
        .from("document_categories")
        .select("*")
        .order("name")
      
      setCategories(categoriesData || [])
      
      // Fetch documents
      const { data: documentsData } = await supabase
        .from("documents")
        .select("*, category:document_categories(*)")
        .order("created_at", { ascending: false })
      
      setDocuments(documentsData || [])
      
      // Fetch acknowledged documents
      if (user) {
        const { data: ackData } = await supabase
          .from("document_acknowledgements")
          .select("document_id")
          .eq("user_id", user.id)
        
        setAcknowledgedDocs(new Set(ackData?.map(a => a.document_id) || []))
      }
    } catch (error) {
      console.error("Error fetching documents:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcknowledge = async (documentId: string) => {
    try {
      setAcknowledging(documentId)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { error } = await supabase
        .from("document_acknowledgements")
        .insert({
          document_id: documentId,
          user_id: user.id,
        })
      
      if (error) throw error
      
      setAcknowledgedDocs(prev => new Set([...prev, documentId]))
      toast.success("Ознакомление подтверждено")
    } catch (error) {
      console.error("Error acknowledging document:", error)
      toast.error("Ошибка при подтверждении ознакомления")
    } finally {
      setAcknowledging(null)
    }
  }

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage.from("documents").getPublicUrl(filePath)
    return data.publicUrl
  }

  const mandatoryDocs = documents.filter(d => d.mandatory && !acknowledgedDocs.has(d.id))
  const allDocs = documents

  const DocumentCard = ({ doc }: { doc: DocumentWithCategory }) => {
    const isAcknowledged = acknowledgedDocs.has(doc.id)
    
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{doc.title}</CardTitle>
                <CardDescription>
                  {doc.category?.name} • Версия {doc.version}
                </CardDescription>
              </div>
            </div>
            {doc.mandatory && (
              <Badge variant={isAcknowledged ? "default" : "destructive"}>
                {isAcknowledged ? "Ознакомлен" : "Обязателен"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {doc.description && (
            <p className="text-sm text-muted-foreground mb-4">{doc.description}</p>
          )}
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {doc.effective_from && (
                <span>Действует с: {formatDate(doc.effective_from)}</span>
              )}
            </div>
            
            <div className="flex gap-2">
              <a href={getFileUrl(doc.file_path)} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Открыть
                </Button>
              </a>
              
              {doc.mandatory && !isAcknowledged && (
                <Button
                  size="sm"
                  onClick={() => handleAcknowledge(doc.id)}
                  disabled={acknowledging === doc.id}
                >
                  {acknowledging === doc.id ? (
                    "..."
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Ознакомлен
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Документы и регламенты</h1>
        <p className="text-muted-foreground mt-1">
          ЛНА, инструкции, формы и другие документы
        </p>
      </div>

      {/* Mandatory Alert */}
      {mandatoryDocs.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800 text-lg">
              <AlertCircle className="h-5 w-5" />
              Требуется ознакомление
            </CardTitle>
            <CardDescription className="text-red-700">
              У вас {mandatoryDocs.length} обязательных документов для ознакомления
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Documents Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Все документы</TabsTrigger>
          <TabsTrigger value="mandatory">
            Обязательные
            {mandatoryDocs.length > 0 && (
              <Badge variant="destructive" className="ml-2">{mandatoryDocs.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {allDocs.length > 0 ? (
                allDocs.map((doc) => <DocumentCard key={doc.id} doc={doc} />)
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Нет доступных документов</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="mandatory" className="mt-6">
          <div className="space-y-4">
            {mandatoryDocs.length > 0 ? (
              mandatoryDocs.map((doc) => <DocumentCard key={doc.id} doc={doc} />)
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Вы ознакомлены со всеми обязательными документами
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
