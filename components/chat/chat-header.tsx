import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Info, Bell, Settings, LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useChatStore } from "@/lib/chat-store"
import Link from "next/link"
import { ChatActions } from "./chat-actions"

export function ChatHeader() {
  const { activeSessionId, sessions } = useChatStore()

  const activeSession = sessions.find((session) => session.id === activeSessionId)
  const assistantUser = activeSession?.participants.find((p) => p.id === "laya-assistant")

  return (
    <header className="border-b bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/laya-logo.png" alt="Laya" />
            <AvatarFallback>L</AvatarFallback>
          </Avatar>

          <div>
            <h1 className="text-lg font-semibold dark:text-white">{activeSession?.groupName || "Trợ Lý Laya"}</h1>
            <div className="flex items-center">
              <Badge variant="outline" className="text-xs font-normal px-1 py-0">
                <span className="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
                Trực tuyến
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <ChatActions />

          <Link href="/admin" className="mr-2">
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Info className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Info className="h-4 w-4 mr-2" />
                Thông tin
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell className="h-4 w-4 mr-2" />
                Thông báo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="h-4 w-4 mr-2" />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
