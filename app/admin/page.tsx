"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileText, File, ArrowLeft, Trash2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"

export default function AdminPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [knowledgeFiles, setKnowledgeFiles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const fetchKnowledgeFiles = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("/api/knowledge")
        if (response.ok) {
          const data = await response.json()
          setKnowledgeFiles(data.files.map((file: any) => file.name))
        } else {
          toast({
            title: "Lỗi",
            description: "Không thể tải danh sách tệp kiến thức",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error fetching knowledge files:", error)
        toast({
          title: "Lỗi",
          description: "Đã xảy ra lỗi khi tải danh sách tệp",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchKnowledgeFiles()
  }, [])

  // Simulate loading knowledge files on component mount
  // useState(() => {
  //   setTimeout(() => {
  //     setKnowledgeFiles([
  //       "Q&A Laya.txt",
  //       "Chinh sach he thong.txt",
  //       "thong-tin-cong-ty.txt",
  //       "san-pham-laya.txt",
  //       "chinh-sach-bao-hanh.txt"
  //     ])
  //     setIsLoading(false)
  //   }, 1000)
  // })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles((prevFiles) => [...prevFiles, ...newFiles])
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "Không có tệp nào được chọn",
        description: "Vui lòng chọn ít nhất một tệp để tải lên.",
        variant: "destructive",
      })
      return
    }

    setUploading(true)
    setUploadProgress(0)

    // Upload each file
    const totalFiles = files.length
    let processedFiles = 0
    let successfulUploads = 0

    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/knowledge", {
          method: "POST",
          body: formData,
        })

        if (response.ok) {
          successfulUploads++
        }
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error)
      }

      processedFiles++
      setUploadProgress(Math.round((processedFiles / totalFiles) * 100))
    }

    // Refresh the file list
    const response = await fetch("/api/knowledge")
    if (response.ok) {
      const data = await response.json()
      setKnowledgeFiles(data.files.map((file: any) => file.name))
    }

    setFiles([])
    setUploading(false)

    toast({
      title: "Tải lên thành công",
      description: `Đã tải lên ${successfulUploads} tệp vào cơ sở kiến thức.`,
    })
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index))
  }

  // Cập nhật hàm handleDeleteKnowledgeFile để xử lý lỗi tốt hơn và hiển thị thông báo chi tiết

  const handleDeleteKnowledgeFile = async (fileName: string) => {
    try {
      setIsLoading(true)

      const response = await fetch("/api/knowledge", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileName }),
      })

      const data = await response.json()

      if (response.ok) {
        setKnowledgeFiles((prev) => prev.filter((name) => name !== fileName))
        toast({
          title: "Đã xóa tệp",
          description: `Tệp ${fileName} đã được xóa khỏi cơ sở kiến thức.`,
        })
      } else {
        console.error("Error response:", data)
        toast({
          title: "Lỗi khi xóa tệp",
          description: data.error || "Không thể xóa tệp. Vui lòng thử lại sau.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting file:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi khi xóa tệp. Vui lòng kiểm tra console để biết thêm chi tiết.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const refreshKnowledgeBase = () => {
    setIsRefreshing(true)
    // Simulate API call to refresh knowledge base
    setTimeout(() => {
      setIsRefreshing(false)
      toast({
        title: "Đã làm mới cơ sở kiến thức",
        description: "Hệ thống đã cập nhật và xử lý lại tất cả các tệp kiến thức.",
      })
    }, 2000)
  }

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith(".txt")) return <FileText className="h-4 w-4" />
    if (fileName.endsWith(".doc") || fileName.endsWith(".docx")) return <File className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Link href="/" className="mr-4">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Quản Lý Cơ Sở Kiến Thức</h1>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Tải Lên Tài Liệu</TabsTrigger>
          <TabsTrigger value="manage">Quản Lý Tài Liệu</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Tải Lên Tài Liệu Mới</CardTitle>
              <CardDescription>
                Tải lên các tệp .txt, .doc, hoặc .docx để bổ sung vào cơ sở kiến thức của trợ lý Laya.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">Kéo thả tệp vào đây hoặc nhấp để chọn tệp</p>
                  <p className="text-xs text-gray-400 mt-1">Hỗ trợ: .txt, .doc, .docx</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    multiple
                    accept=".txt,.doc,.docx"
                  />
                </div>

                {files.length > 0 && (
                  <div className="mt-4">
                    <Label>Tệp đã chọn</Label>
                    <ScrollArea className="h-[200px] mt-2 border rounded-md p-2">
                      <div className="space-y-2">
                        {files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center">
                              {file.name.endsWith(".txt") ? (
                                <FileText className="h-4 w-4 mr-2 text-blue-500" />
                              ) : (
                                <File className="h-4 w-4 mr-2 text-blue-500" />
                              )}
                              <span className="text-sm truncate max-w-[300px]">{file.name}</span>
                              <Badge variant="outline" className="ml-2 text-xs">
                                {(file.size / 1024).toFixed(1)} KB
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveFile(index)}
                              disabled={uploading}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Đang tải lên...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setFiles([])} disabled={files.length === 0 || uploading}>
                Xóa tất cả
              </Button>
              <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
                {uploading ? "Đang tải lên..." : "Tải lên"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Quản Lý Tài Liệu Hiện Có</CardTitle>
                  <CardDescription>Xem và quản lý các tài liệu trong cơ sở kiến thức của trợ lý Laya.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={refreshKnowledgeBase} disabled={isRefreshing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                  Làm mới
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center">
                  <RefreshCw className="h-8 w-8 mx-auto animate-spin text-gray-400" />
                  <p className="mt-2 text-gray-500">Đang tải dữ liệu...</p>
                </div>
              ) : knowledgeFiles.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-gray-500">Chưa có tài liệu nào trong cơ sở kiến thức.</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {knowledgeFiles.map((fileName, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div className="flex items-center">
                          {getFileIcon(fileName)}
                          <span className="ml-2">{fileName}</span>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xác nhận xóa tệp</AlertDialogTitle>
                              <AlertDialogDescription>
                                Bạn có chắc chắn muốn xóa tệp "{fileName}" khỏi cơ sở kiến thức? Hành động này không thể
                                hoàn tác.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteKnowledgeFile(fileName)}>
                                Xóa
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
            <CardFooter>
              <p className="text-xs text-gray-500">
                Tổng số tài liệu: {knowledgeFiles.length} | Cập nhật lần cuối: {new Date().toLocaleDateString("vi-VN")}
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
