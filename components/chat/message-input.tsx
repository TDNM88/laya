"use client"

import type React from "react"

import { useState, useRef, type ChangeEvent, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Paperclip, X, ImageIcon, FileText, Video, AlertCircle, RefreshCw, Wifi, WifiOff } from "lucide-react"
import { useChatStore } from "@/lib/chat-store"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function MessageInput() {
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [networkStatus, setNetworkStatus] = useState<"online" | "offline" | "reconnecting">("online")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)

  const { sendMessage, isTyping, error, clearError, isConnected } = useChatStore()

  // Theo dõi trạng thái kết nối mạng
  useEffect(() => {
    const handleOnline = () => setNetworkStatus("online")
    const handleOffline = () => setNetworkStatus("offline")

    // Kiểm tra trạng thái ban đầu
    setNetworkStatus(navigator.onLine ? "online" : "offline")

    // Đăng ký sự kiện
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Cập nhật trạng thái kết nối từ store
  useEffect(() => {
    if (!isConnected && networkStatus === "online") {
      setNetworkStatus("reconnecting")
    } else if (isConnected && networkStatus === "reconnecting") {
      setNetworkStatus("online")
    }
  }, [isConnected, networkStatus])

  // Focus vào input khi component được mount
  useEffect(() => {
    if (messageInputRef.current) {
      messageInputRef.current.focus()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim() && attachments.length === 0) return
    if (networkStatus === "offline") {
      alert("Bạn đang offline. Vui lòng kết nối mạng để gửi tin nhắn.")
      return
    }

    try {
      setIsRetrying(false)
      await sendMessage(message, attachments)
      setMessage("")
      setAttachments([])

      // Focus lại vào input sau khi gửi
      setTimeout(() => {
        if (messageInputRef.current) {
          messageInputRef.current.focus()
        }
      }, 0)
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  const handleRetry = async () => {
    if (!message.trim() && attachments.length === 0) return

    setIsRetrying(true)
    try {
      clearError()
      await sendMessage(message, attachments)
      setMessage("")
      setAttachments([])
    } catch (error) {
      console.error("Error retrying message:", error)
    } finally {
      setIsRetrying(false)
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return

    // Kiểm tra kích thước tệp
    const maxSize = 10 * 1024 * 1024 // 10MB
    const files = Array.from(e.target.files)
    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        alert(`Tệp "${file.name}" quá lớn. Kích thước tối đa là 10MB.`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    // Simulate upload progress
    setIsUploading(true)
    setUploadProgress(0)

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsUploading(false)
          return 100
        }
        return prev + 10
      })
    }, 200)

    setAttachments((prev) => [...prev, ...validFiles])

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const getAttachmentIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <ImageIcon className="h-4 w-4 text-blue-500" />
    } else if (file.type.startsWith("video/")) {
      return <Video className="h-4 w-4 text-red-500" />
    } else {
      return <FileText className="h-4 w-4 text-green-500" />
    }
  }

  const getNetworkStatusIcon = () => {
    switch (networkStatus) {
      case "online":
        return <Wifi className="h-4 w-4 text-green-500" />
      case "offline":
        return <WifiOff className="h-4 w-4 text-red-500" />
      case "reconnecting":
        return <RefreshCw className="h-4 w-4 animate-spin text-yellow-500" />
    }
  }

  return (
    <div className="p-4 border-t bg-white dark:bg-gray-900 dark:border-gray-800 transition-all shadow-sm sticky bottom-0 z-10">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Lỗi</AlertTitle>
          <AlertDescription className="flex justify-between items-center">
            <span>{error}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={clearError}>
                <X className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleRetry} disabled={isRetrying}>
                {isRetrying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-1">Thử lại</span>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {networkStatus === "offline" && (
        <Alert variant="destructive" className="mb-4">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Mất kết nối</AlertTitle>
          <AlertDescription>
            Không có kết nối mạng. Vui lòng kiểm tra kết nối internet của bạn và thử lại sau.
          </AlertDescription>
        </Alert>
      )}

      {networkStatus === "reconnecting" && (
        <Alert className="mb-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-900 dark:border-yellow-800">
          <RefreshCw className="h-4 w-4 animate-spin text-yellow-500" />
          <AlertTitle>Đang kết nối lại...</AlertTitle>
          <AlertDescription>Đang cố gắng kết nối lại với máy chủ. Vui lòng đợi trong giây lát.</AlertDescription>
        </Alert>
      )}

      {attachments.length > 0 && (
        <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-fadeIn">
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div 
                key={index} 
                className="flex items-center bg-white dark:bg-gray-700 rounded-md p-1.5 pr-2 shadow-sm transition-all hover:shadow-md"
              >
                {getAttachmentIcon(file)}
                <span className="mx-1.5 text-sm truncate max-w-[150px] dark:text-white">{file.name}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600" 
                  onClick={() => removeAttachment(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {isUploading && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Đang tải lên...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-1" />
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Input
            ref={messageInputRef}
            type="text"
            placeholder={
              isTyping 
                ? "Trợ lý đang nhập..." 
                : networkStatus === "offline" 
                  ? "Đang mất kết nối..." 
                  : "Nhập tin nhắn của bạn..."
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="pr-12 py-6 text-base rounded-full pl-5 shadow-sm border-gray-300 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-primary transition-all"
            disabled={isTyping || networkStatus === "offline"}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isTyping || networkStatus === "offline"}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Đính kèm tệp</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
            accept="image/*,video/*,application/*"
            disabled={isTyping || networkStatus === "offline"}
          />
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={(!message.trim() && attachments.length === 0) || isTyping || networkStatus === "offline"}
          className={`h-12 w-12 rounded-full ${isTyping ? "opacity-50 cursor-not-allowed" : "hover:scale-105 transition-transform"}`}
        >
          <Send className="h-5 w-5" />
        </Button>
      </form>

      {/* Network status indicator */}
      <div className="flex justify-end mt-2">
        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
          <span className="mr-1">{getNetworkStatusIcon()}</span>
          <span>
            {networkStatus === "online"
              ? "Đã kết nối"
              : networkStatus === "offline"
              ? "Mất kết nối"
              : "Đang kết nối lại..."}
          </span>
        </div>
      </div>
    </div>
  )
}
