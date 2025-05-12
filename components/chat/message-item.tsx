"use client"

import { useState, useRef, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Check, Edit, Trash2, MoreVertical, ImageIcon, File, Smile, ThumbsUp, ThumbsDown, Copy, CheckCheck } from "lucide-react"
import type { Message, Attachment } from "@/types/chat"
import { useChatStore } from "@/lib/chat-store"
import ReactMarkdown from "react-markdown"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "😡"]

interface MessageItemProps {
  message: Message
}

export function MessageItem({ message }: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(message.content)
  const [isCopied, setIsCopied] = useState(false)
  const editInputRef = useRef<HTMLTextAreaElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)

  const { editMessage, deleteMessage, markAsRead, addReaction, removeReaction, addFeedback } = useChatStore()

  const isUser = message.role === "user"
  const formattedTime = format(new Date(message.timestamp), "HH:mm", { locale: vi })
  const formattedDate = format(new Date(message.timestamp), "dd/MM/yyyy", { locale: vi })
  
  // Kiểm tra tin nhắn hiển thị trong viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !message.isRead && message.role === "assistant") {
          markAsRead(message.id)
        }
      },
      { threshold: 0.5 }
    )
    
    if (messageRef.current) {
      observer.observe(messageRef.current)
    }
    
    return () => {
      if (messageRef.current) {
        observer.unobserve(messageRef.current)
      }
    }
  }, [message.id, message.isRead, message.role, markAsRead])

  const handleEdit = () => {
    setIsEditing(true)
    setTimeout(() => {
      editInputRef.current?.focus()
    }, 0)
  }

  const handleSaveEdit = () => {
    if (editedContent.trim() !== message.content) {
      editMessage(message.id, editedContent)
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditedContent(message.content)
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa tin nhắn này?")) {
      deleteMessage(message.id)
    }
  }
  
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleReaction = (emoji: string) => {
    const hasReacted = message.reactions?.some((r) => r.emoji === emoji && r.users.includes("current-user"))

    if (hasReacted) {
      removeReaction(message.id, emoji)
    } else {
      addReaction(message.id, emoji)
    }
  }

  const handleFeedback = (type: "positive" | "negative") => {
    addFeedback(message.id, type)
  }

  const renderAttachment = (attachment: Attachment) => {
    switch (attachment.type) {
      case "image":
        return (
          <Dialog key={attachment.id}>
            <DialogTrigger asChild>
              <div className="relative cursor-pointer group mt-2 max-w-xs overflow-hidden rounded-md">
                <img
                  src={attachment.url || "/placeholder.svg"}
                  alt={attachment.name}
                  className="w-full h-auto object-cover rounded-md transition-transform hover:scale-105"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all flex items-center justify-center">
                  <ImageIcon className="text-white opacity-0 group-hover:opacity-100 h-8 w-8" />
                </div>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <div className="flex flex-col items-center">
                <img
                  src={attachment.url || "/placeholder.svg"}
                  alt={attachment.name}
                  className="max-h-[80vh] max-w-full object-contain"
                />
                <p className="mt-2 text-sm text-gray-500">{attachment.name}</p>
              </div>
            </DialogContent>
          </Dialog>
        )

      case "video":
        return (
          <div key={attachment.id} className="mt-2 max-w-xs">
            <video src={attachment.url} controls className="w-full rounded-md" />
            <p className="mt-1 text-xs text-gray-500 truncate">{attachment.name}</p>
          </div>
        )

      case "file":
        return (
          <a
            key={attachment.id}
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center p-2 border rounded-md hover:bg-gray-50 transition-colors"
          >
            <File className="h-5 w-5 mr-2 text-blue-500" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{attachment.name}</p>
              <p className="text-xs text-gray-500">
                {attachment.size ? `${Math.round(attachment.size / 1024)} KB` : ""}
              </p>
            </div>
          </a>
        )

      default:
        return null
    }
  }

  return (
    <div 
      ref={messageRef}
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 group animate-fadeIn`}
    >
      <div className={`flex ${isUser ? "flex-row-reverse" : "flex-row"} max-w-[85%] md:max-w-[75%] lg:max-w-[65%]`}>
        {!isUser && (
          <Avatar className="h-8 w-8 mr-2 mt-1">
            <AvatarImage src="/laya-logo.png" alt="Laya" />
            <AvatarFallback>L</AvatarFallback>
          </Avatar>
        )}

        <div className="flex flex-col">
          <div className={`flex items-start ${isUser ? "flex-row-reverse" : "flex-row"}`}>
            <div
              className={`rounded-lg p-3 ${
                isUser
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
              } relative transition-all hover:shadow-md`}
            >
              {isEditing ? (
                <div className="flex flex-col">
                  <textarea
                    ref={editInputRef}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full min-h-[100px] p-2 text-black bg-white border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex justify-end mt-2 space-x-2">
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      Hủy
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Check className="h-4 w-4 mr-1" />
                      Lưu
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert prose-headings:my-2 prose-p:my-1.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
                      <ReactMarkdown>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                </>
              )}

              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((attachment) => renderAttachment(attachment))}
                </div>
              )}
            </div>

            {!isEditing && (
              <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? "mr-2" : "ml-2"} flex items-center gap-1`}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyMessage}>
                        {isCopied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{isCopied ? "Đã sao chép" : "Sao chép"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isUser ? "end" : "start"}>
                    {isUser && (
                      <DropdownMenuItem onClick={handleEdit}>
                        <Edit className="h-4 w-4 mr-2" />
                        Chỉnh sửa
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleDelete}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Xóa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => markAsRead(message.id)}>
                      <Check className="h-4 w-4 mr-2" />
                      Đánh dấu đã đọc
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Feedback buttons for assistant messages */}
          {message.role === "assistant" && !isEditing && (
            <div className="flex mt-1 space-x-1">
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 rounded-full ${message.feedback === "positive" ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400" : ""} transition-colors`}
                onClick={() => handleFeedback("positive")}
                title="Phản hồi hữu ích"
              >
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 rounded-full ${message.feedback === "negative" ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400" : ""} transition-colors`}
                onClick={() => handleFeedback("negative")}
                title="Phản hồi không hữu ích"
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className={`flex mt-1 ${isUser ? "justify-end" : "justify-start"}`}>
              <div className="flex space-x-1">
                {message.reactions.map((reaction) => (
                  <Badge
                    key={reaction.emoji}
                    variant="outline"
                    className="px-2 py-0 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => handleReaction(reaction.emoji)}
                  >
                    {reaction.emoji} {reaction.count}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Message info */}
          <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400 space-x-2">
            <span>{formattedTime}</span>
            <span title={formattedDate}>·</span>

            {message.isRead && message.role === "user" && (
              <span title="Đã đọc" className="text-blue-500 animate-fadeIn">
                <Check className="h-3 w-3" />
              </span>
            )}

            {message.reactions && message.reactions.length > 0 && (
              <div className="flex space-x-1">
                {message.reactions.map((reaction) => (
                  <span
                    key={reaction.emoji}
                    className="bg-gray-100 dark:bg-gray-800 rounded-full px-1.5 py-0.5 flex items-center transition-transform hover:scale-110"
                  >
                    {reaction.emoji} <span className="ml-1 text-[10px]">{reaction.count}</span>
                  </span>
                ))}
              </div>
            )}

            {message.feedback && (
              <span
                className={`flex items-center ${message.feedback === "positive" ? "text-green-500" : "text-red-500"}`}
              >
                {message.feedback === "positive" ? (
                  <ThumbsUp className="h-3 w-3" />
                ) : (
                  <ThumbsDown className="h-3 w-3" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
