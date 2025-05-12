"use client"

import { useState, useEffect } from "react"
import { ChatContainer } from "@/components/chat/chat-container"
import { ChatHeader } from "@/components/chat/chat-header"
import { MessageInput } from "@/components/chat/message-input"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { useChatStore } from "@/lib/chat-store"
import { Menu, X, Loader2, WifiOff, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

export default function ChatPage() {
  const { theme, setTheme, isConnected } = useChatStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [showStatus, setShowStatus] = useState(false)

  // Kiểm tra kích thước màn hình để xác định có phải là mobile hay không
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    // Kiểm tra ban đầu
    checkMobile()
    
    // Thêm sự kiện resize để cập nhật khi thay đổi kích thước màn hình
    window.addEventListener('resize', checkMobile)
    
    // Xóa sự kiện khi unmount
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Đóng sidebar khi chuyển sang mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false)
    }
  }, [isMobile])

  // Kiểm tra kết nối API
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Gọi API để kiểm tra kết nối
        const response = await fetch('/api/health')
        
        if (response.ok) {
          const data = await response.json()
          // Hiển thị trạng thái kết nối thành công
          setIsOnline(true)
          setShowStatus(false) // Ẩn thông báo lỗi nếu đã hiển thị trước đó
          console.log('API health check successful:', data)
        } else {
          console.error('API health check failed: Status', response.status)
          setIsOnline(false)
          setShowStatus(true) // Hiển thị thông báo lỗi
        }
      } catch (error) {
        console.error('API health check error:', error)
        setIsOnline(false)
        setShowStatus(true) // Hiển thị thông báo lỗi
      }
    }

    // Kiểm tra kết nối ban đầu
    checkConnection()

    // Thiết lập interval để kiểm tra kết nối mỗi 30 giây
    const intervalId = setInterval(checkConnection, 30000)

    // Dọn dẹp interval khi unmount
    return () => clearInterval(intervalId)
  }, [])

  // Thiết lập chủ đề màu dựa trên tùy chọn của người dùng hoặc chế độ màu của hệ thống
  useEffect(() => {
    // Kiểm tra xem người dùng đã chọn chủ đề nào chưa
    const savedTheme = localStorage.getItem('theme') as "light" | "dark" | "system" | null
    
    if (savedTheme && (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system")) {
      setTheme(savedTheme)
    } else {
      // Sử dụng chế độ màu của hệ thống
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefersDark ? 'dark' : 'light')
    }
  }, [setTheme])
  
  // Cập nhật class cho body khi theme thay đổi
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    // Lưu theme vào localStorage
    localStorage.setItem('theme', theme)
  }, [theme])

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

  // Biến để theo dõi việc component đã được mount hay chưa
  const [isMounted, setIsMounted] = useState(false)
  
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
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
        {/* Overlay khi mất kết nối */}
        {!isConnected && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg text-center max-w-md mx-4">
              {!isOnline ? (
                <>
                  <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <WifiOff className="h-8 w-8 text-red-500 dark:text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 dark:text-white">Không có kết nối mạng</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Vui lòng kiểm tra kết nối internet của bạn và thử lại. Ứng dụng sẽ tự động kết nối lại khi có mạng.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 dark:text-white">Đang kết nối lại...</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Không thể kết nối đến máy chủ. Vui lòng đợi trong giây lát hoặc thử làm mới trang.
                  </p>
                </>
              )}
              <Button 
                onClick={handleRetryConnection} 
                className="bg-primary hover:bg-primary/90 text-white font-medium px-4 py-2 rounded-md transition-colors"
              >
                Thử lại
              </Button>
            </div>
          </div>
        )}

        <ChatHeader />

        <div className="flex-1 overflow-hidden">
          {/* Giao diện desktop sử dụng ResizablePanelGroup */}
          {!isMobile ? (
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={25} minSize={20} maxSize={30}>
                <ChatSidebar />
              </ResizablePanel>

              <ResizableHandle withHandle className="bg-gray-200 dark:bg-gray-700 transition-colors" />

              <ResizablePanel defaultSize={75}>
                <div className="flex flex-col h-full">
                  {/* Thêm nút để hiển thị/ẩn trạng thái kết nối */}
                  <div className="px-4 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowStatus(!showStatus)} 
                      className="text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      {showStatus ? "Ẩn trạng thái hệ thống" : "Hiển thị trạng thái hệ thống"}
                    </Button>

                    {showStatus && (
                      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm border border-gray-200 dark:border-gray-700 animate-fadeIn shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                          <p className="font-medium">
                            {isConnected ? 'Đã kết nối đến API' : 'Mất kết nối đến API'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                          <p className="font-medium">
                            {isOnline ? 'Đang trực tuyến' : 'Mất kết nối mạng'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <ChatContainer />
                  <MessageInput />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            /* Giao diện mobile */
            <div className="flex flex-col h-full relative">
              {/* Nút mở sidebar trên mobile */}
              {!sidebarOpen && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setSidebarOpen(true)} 
                  className="absolute top-2 left-2 z-10 rounded-full h-10 w-10 bg-white dark:bg-gray-800 shadow-md hover:scale-105 transition-transform"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              
              {/* Sidebar trên mobile */}
              {sidebarOpen && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-50 animate-fadeIn">
                  <div className="h-full w-4/5 max-w-xs bg-white dark:bg-gray-900 shadow-xl animate-slideIn">
                    <div className="flex justify-between items-center p-4 border-b dark:border-gray-800">
                      <h2 className="font-semibold text-lg dark:text-white">Trợ Lý Laya</h2>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setSidebarOpen(false)}
                        className="rounded-full h-8 w-8"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                    <ChatSidebar />
                  </div>
                </div>
              )}
              
              <div className="flex flex-col h-full">
                {/* Trạng thái hệ thống trên mobile */}
                {showStatus && (
                  <div className="px-4 pt-2 animate-fadeIn">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <p className="font-medium">
                          {isConnected ? 'Đã kết nối đến API' : 'Mất kết nối đến API'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <p className="font-medium">
                          {isOnline ? 'Đang trực tuyến' : 'Mất kết nối mạng'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <ChatContainer />
                <MessageInput />
              </div>
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  )
}
