"use client"

import { useState, useEffect } from "react"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { ChatContainer } from "@/components/chat/chat-container"
import { MessageInput } from "@/components/chat/message-input"
import { ConnectionStatus } from "@/components/chat/connection-status"
import { useChatStore } from "@/lib/chat-store"
import { Loader2, WifiOff } from "lucide-react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Button } from "@/components/ui/button"
import { ThemeProvider } from "@/components/theme-provider"

export default function ChatPage() {
  const [isMounted, setIsMounted] = useState(false)
  const { isConnected, theme } = useChatStore()
  const [isOnline, setIsOnline] = useState(true)
  const [showStatus, setShowStatus] = useState(false)

  // Theo dõi trạng thái kết nối mạng
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    // Kiểm tra trạng thái ban đầu
    setIsOnline(navigator.onLine)

    // Đăng ký sự kiện
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Khởi tạo theme
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else if (theme === "light") {
      document.documentElement.classList.remove("dark")
    } else if (theme === "system") {
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      if (systemPrefersDark) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }
  }, [theme])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleRetryConnection = () => {
    // Làm mới trang để thử kết nối lại
    window.location.reload()
  }

  if (!isMounted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <ThemeProvider>
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
        {!isConnected && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg text-center max-w-md">
              {!isOnline ? (
                <>
                  <WifiOff className="h-12 w-12 mx-auto mb-4 text-destructive" />
                  <h3 className="text-lg font-semibold mb-2 dark:text-white">Không có kết nối mạng</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Vui lòng kiểm tra kết nối internet của bạn và thử lại. Ứng dụng sẽ tự động kết nối lại khi có mạng.
                  </p>
                </>
              ) : (
                <>
                  <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                  <h3 className="text-lg font-semibold mb-2 dark:text-white">Đang kết nối lại...</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Không thể kết nối đến máy chủ. Vui lòng đợi trong giây lát hoặc thử làm mới trang.
                  </p>
                </>
              )}
              <Button onClick={handleRetryConnection}>Thử lại</Button>
            </div>
          </div>
        )}

        <ChatHeader />

        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={25} minSize={20} maxSize={30}>
              <ChatSidebar />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={75}>
              <div className="flex flex-col h-full">
                {/* Thêm nút để hiển thị/ẩn trạng thái kết nối */}
                <div className="px-4 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setShowStatus(!showStatus)} className="text-xs">
                    {showStatus ? "Ẩn trạng thái hệ thống" : "Hiển thị trạng thái hệ thống"}
                  </Button>

                  {showStatus && <ConnectionStatus />}
                </div>

                <ChatContainer />
                <MessageInput />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </ThemeProvider>
  )
}
