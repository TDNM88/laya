"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, MoreVertical, Download, Edit, Moon, Sun, Monitor, Search, MessageSquarePlus } from "lucide-react"
import { useChatStore } from "@/lib/chat-store"

export function ChatActions() {
  const {
    activeSessionId,
    sessions,
    clearSessionHistory,
    renameSession,
    deleteSession,
    createSession,
    theme,
    setTheme,
  } = useChatStore()
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [newSessionName, setNewSessionName] = useState("")

  const activeSession = sessions.find((session) => session.id === activeSessionId)

  if (!activeSession) return null

  const handleClearHistory = () => {
    if (activeSessionId) {
      clearSessionHistory(activeSessionId)
    }
  }

  const handleRenameSession = () => {
    if (activeSessionId && newSessionName.trim()) {
      renameSession(activeSessionId, newSessionName.trim())
      setIsRenameDialogOpen(false)
      setNewSessionName("")
    }
  }

  const handleDeleteSession = () => {
    if (activeSessionId) {
      deleteSession(activeSessionId)
    }
  }

  const handleNewChat = () => {
    createSession([{ id: "laya-assistant", name: "Trợ Lý Laya", avatar: "/laya-logo.png" }])
  }

  const handleExportChat = () => {
    if (!activeSession) return

    const messages = activeSession.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }))

    const chatData = {
      title: activeSession.groupName || "Cuộc trò chuyện Laya",
      date: new Date().toISOString(),
      messages,
    }

    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `laya-chat-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center">
      <Button variant="ghost" size="icon" onClick={handleNewChat} title="Cuộc trò chuyện mới">
        <MessageSquarePlus className="h-5 w-5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsRenameDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Đổi tên cuộc trò chuyện
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleExportChat}>
            <Download className="h-4 w-4 mr-2" />
            Xuất cuộc trò chuyện
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled>
            <Search className="h-4 w-4 mr-2" />
            Tìm kiếm tin nhắn
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                <span className="text-destructive">Xóa lịch sử trò chuyện</span>
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xóa lịch sử trò chuyện?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bạn có chắc chắn muốn xóa tất cả tin nhắn trong cuộc trò chuyện này? Hành động này không thể hoàn tác.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearHistory}>Xóa lịch sử</AlertDialogAction>
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
                    Bạn có chắc chắn muốn xóa cuộc trò chuyện này? Tất cả tin nhắn sẽ bị mất và không thể khôi phục.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteSession}>Xóa cuộc trò chuyện</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun className={`h-4 w-4 mr-2 ${theme === "light" ? "text-primary" : ""}`} />
            Giao diện sáng
            {theme === "light" && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon className={`h-4 w-4 mr-2 ${theme === "dark" ? "text-primary" : ""}`} />
            Giao diện tối
            {theme === "dark" && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Monitor className={`h-4 w-4 mr-2 ${theme === "system" ? "text-primary" : ""}`} />
            Theo hệ thống
            {theme === "system" && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
                placeholder={activeSession.groupName || "Cuộc trò chuyện mới"}
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
