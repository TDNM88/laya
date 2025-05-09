"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Search, Users, MessageSquare, X, MoreHorizontal, Edit, Trash2 } from "lucide-react"
import { useChatStore } from "@/lib/chat-store"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export function ChatSidebar() {
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [sessionToRename, setSessionToRename] = useState<string | null>(null)
  const [newSessionName, setNewSessionName] = useState("")

  const {
    sessions,
    activeSessionId,
    setActiveSession,
    createSession,
    renameSession,
    deleteSession,
    clearSessionHistory,
  } = useChatStore()

  // Sort sessions by updatedAt (most recent first)
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  // Filter sessions by search query
  const filteredSessions = searchQuery
    ? sortedSessions.filter((session) => {
        const lastMessage = session.messages[session.messages.length - 1]
        return (
          (session.groupName && session.groupName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (lastMessage && lastMessage.content.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      })
    : sortedSessions

  const handleCreateNewChat = () => {
    createSession([{ id: "laya-assistant", name: "Trợ Lý Laya", avatar: "/laya-logo.png" }])
  }

  const handleOpenRenameDialog = (sessionId: string, currentName?: string) => {
    setSessionToRename(sessionId)
    setNewSessionName(currentName || "")
    setIsRenameDialogOpen(true)
  }

  const handleRenameSession = () => {
    if (sessionToRename && newSessionName.trim()) {
      renameSession(sessionToRename, newSessionName.trim())
      setIsRenameDialogOpen(false)
      setSessionToRename(null)
      setNewSessionName("")
    }
  }

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId)
  }

  const handleClearSessionHistory = (sessionId: string) => {
    clearSessionHistory(sessionId)
  }

  return (
    <div className="w-64 border-r bg-gray-50 dark:bg-gray-900 dark:border-gray-800 flex flex-col h-full">
      <div className="p-3 border-b bg-white dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold dark:text-white">Trò chuyện</h2>
          <Button variant="ghost" size="icon" onClick={handleCreateNewChat}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {isSearching ? (
          <div className="flex items-center">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm..."
              className="flex-1"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="ml-1"
              onClick={() => {
                setIsSearching(false)
                setSearchQuery("")
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full justify-start text-gray-500" onClick={() => setIsSearching(true)}>
            <Search className="h-4 w-4 mr-2" />
            Tìm kiếm
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredSessions.map((session) => {
            const lastMessage = session.messages[session.messages.length - 1]
            const isActive = session.id === activeSessionId
            const formattedDate = lastMessage ? format(new Date(lastMessage.timestamp), "HH:mm", { locale: vi }) : ""

            return (
              <div
                key={session.id}
                className={cn(
                  "flex items-center p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group",
                  isActive && "bg-gray-100 dark:bg-gray-800",
                )}
              >
                <div className="flex-1 min-w-0" onClick={() => setActiveSession(session.id)}>
                  <Avatar className="h-10 w-10 mr-3 float-left">
                    {session.isGroup ? (
                      <div className="h-full w-full flex items-center justify-center bg-primary text-primary-foreground">
                        <Users className="h-5 w-5" />
                      </div>
                    ) : (
                      <>
                        <AvatarImage src="/laya-logo.png" alt="Laya" />
                        <AvatarFallback>L</AvatarFallback>
                      </>
                    )}
                  </Avatar>

                  <div className="ml-12">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium truncate dark:text-white">{session.groupName || "Trợ Lý Laya"}</h3>
                      {lastMessage && <span className="text-xs text-gray-500">{formattedDate}</span>}
                    </div>

                    <p className="text-sm text-gray-500 truncate">
                      {lastMessage
                        ? lastMessage.content.substring(0, 30) + (lastMessage.content.length > 30 ? "..." : "")
                        : "Bắt đầu cuộc trò chuyện mới"}
                    </p>
                  </div>
                </div>

                <div className="opacity-0 group-hover:opacity-100 ml-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenRenameDialog(session.id, session.groupName)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Đổi tên
                      </DropdownMenuItem>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                            <span className="text-destructive">Xóa lịch sử</span>
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Xóa lịch sử trò chuyện?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Bạn có chắc chắn muốn xóa tất cả tin nhắn trong cuộc trò chuyện này? Hành động này không
                              thể hoàn tác.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleClearSessionHistory(session.id)}>
                              Xóa lịch sử
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {sessions.length > 1 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                              <span className="text-destructive">Xóa cuộc trò chuyện</span>
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xóa cuộc trò chuyện?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Bạn có chắc chắn muốn xóa cuộc trò chuyện này? Tất cả tin nhắn sẽ bị mất và không thể
                                khôi phục.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteSession(session.id)}>
                                Xóa cuộc trò chuyện
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}

          {filteredSessions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Không có cuộc trò chuyện nào</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={handleCreateNewChat}>
                Bắt đầu cuộc trò chuyện
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên cuộc trò chuyện</DialogTitle>
            <DialogDescription>Nhập tên mới cho cuộc trò chuyện này.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Tên
              </Label>
              <Input
                id="name"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="Cuộc trò chuyện mới"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleRenameSession} disabled={!newSessionName.trim()}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
