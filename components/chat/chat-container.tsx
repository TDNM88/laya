"use client"

import { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageItem } from "@/components/chat/message-item"
import { useChatStore } from "@/lib/chat-store"
import { Loader2, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ChatContainer() {
  const { activeSessionId, sessions, isTyping } = useChatStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const activeSession = sessions.find((session) => session.id === activeSessionId)
  const messages = activeSession?.messages || []

  // Kiểm tra vị trí cuộn và hiển thị nút cuộn xuống khi cần
  const handleScroll = () => {
    if (!scrollAreaRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }

  // Cuộn xuống dưới khi tin nhắn thay đổi hoặc khi đang nhập
  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])
  
  // Hàm cuộn xuống cuối cùng
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <ScrollArea 
        className="flex-1 p-4 h-full" 
        onScrollCapture={handleScroll}
        ref={scrollAreaRef}
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center p-8">
            <div className="max-w-md animate-fadeIn">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <img src="/laya-logo.png" alt="Laya" className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-semibold mb-3 dark:text-white">Chào mừng đến với Trợ Lý Laya</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Hãy hỏi tôi bất cứ điều gì về công ty Laya và các sản phẩm của chúng tôi. Tôi ở đây để giúp bạn!
              </p>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                <p className="font-medium mb-1">Gợi ý câu hỏi:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Laya có những sản phẩm nào?</li>
                  <li>Làm thế nào để trở thành Mentor?</li>
                  <li>Chính sách hỗ trợ của Laya là gì?</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}

            {isTyping && (
              <div className="flex justify-start mb-4 animate-pulse-once">
                <div className="flex items-center bg-muted dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <p className="text-sm dark:text-white">Trợ lý đang nhập...</p>
                </div>
              </div>
            )}

            <div ref={scrollRef} className="h-1" />
          </div>
        )}
      </ScrollArea>
      
      {showScrollButton && (
        <Button 
          variant="outline" 
          size="icon" 
          className="absolute bottom-4 right-4 rounded-full h-10 w-10 bg-white dark:bg-gray-800 shadow-md animate-fadeIn hover:scale-105 transition-transform"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-5 w-5" />
        </Button>
      )}
    </div>
  )
}
