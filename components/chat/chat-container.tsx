"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageItem } from "./message-item"
import { useChatStore } from "@/lib/chat-store"
import { Loader2 } from "lucide-react"

export function ChatContainer() {
  const { activeSessionId, sessions, isTyping } = useChatStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeSession = sessions.find((session) => session.id === activeSessionId)
  const messages = activeSession?.messages || []

  // Scroll to bottom when messages change or when typing
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isTyping])

  return (
    <ScrollArea className="flex-1 p-4">
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-center p-8">
          <div className="max-w-md">
            <h2 className="text-2xl font-semibold mb-2 dark:text-white">Chào mừng đến với Trợ Lý Laya</h2>
            <p className="text-gray-500 dark:text-gray-400">
              Hãy hỏi tôi bất cứ điều gì về công ty Laya và các sản phẩm của chúng tôi. Tôi ở đây để giúp bạn!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}

          {isTyping && (
            <div className="flex justify-start mb-4">
              <div className="flex items-center bg-muted dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <p className="text-sm dark:text-white">Trợ lý đang nhập...</p>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      )}
    </ScrollArea>
  )
}
