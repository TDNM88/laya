import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Info, Bell, Settings, LogOut, Sun, Moon, Menu, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useChatStore } from "@/lib/chat-store"
import Link from "next/link"
import { ChatActions } from "./chat-actions"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function ChatHeader() {
  const { activeSessionId, sessions, theme, setTheme } = useChatStore()
  const [showThemeMenu, setShowThemeMenu] = useState(false)

  const activeSession = sessions.find((session) => session.id === activeSessionId)
  const assistantUser = activeSession?.participants.find((p) => p.id === "laya-assistant")
  
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
  }

  return (
    <header className="border-b bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-md sticky top-0 z-20 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-primary/20 p-0.5">
            <AvatarImage src="/laya-logo.png" alt="Laya" className="rounded-full" />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">L</AvatarFallback>
          </Avatar>

          <div>
            <h1 className="text-lg font-semibold dark:text-white transition-colors">
              {activeSession?.groupName || "Trợ Lý Laya"}
            </h1>
            <div className="flex items-center">
              <Badge 
                variant="outline" 
                className="text-xs font-normal px-2 py-0.5 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 transition-colors"
              >
                <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                Trực tuyến
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleTheme} 
                  className="rounded-full h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {theme === "dark" ? (
                    <Sun className="h-[18px] w-[18px] text-amber-500" />
                  ) : (
                    <Moon className="h-[18px] w-[18px] text-indigo-500" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Chuyển chế độ {theme === "dark" ? "sáng" : "tối"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <ChatActions />

          <Link href="/admin" className="mr-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Settings className="h-[18px] w-[18px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Cài đặt</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Link>

          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Info className="h-[18px] w-[18px]" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Thông tin</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-56 p-2">
              <DropdownMenuItem className="rounded-md cursor-pointer transition-colors">
                <Info className="h-4 w-4 mr-2" />
                Thông tin
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-md cursor-pointer transition-colors">
                <Bell className="h-4 w-4 mr-2" />
                Thông báo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-md cursor-pointer transition-colors text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
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
