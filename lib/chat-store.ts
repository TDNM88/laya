import { create } from "zustand"
// Sử dụng cú pháp import mới cho zustand v5
import { createJSONStorage, persist } from "zustand/middleware"
import { v4 as uuidv4 } from "uuid"
import type { ChatState, Message, User } from "@/types/chat"
import { fetchWithRetry } from "@/lib/utils"

// Mock current user
const currentUser: User = {
  id: "current-user",
  name: "Người dùng",
  isOnline: true,
}

// Mock assistant user
const assistantUser: User = {
  id: "laya-assistant",
  name: "Trợ Lý Laya",
  avatar: "/laya-logo.png",
  isOnline: true,
}

const initialState: ChatState = {
  sessions: [
    {
      id: "default-session",
      messages: [],
      participants: [currentUser, assistantUser],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  activeSessionId: "default-session",
  isConnected: true,
  isTyping: false,
  error: null,
  theme: "light",
}

export const useChatStore = create<
  ChatState & {
    sendMessage: (content: string, attachments?: File[]) => Promise<void>
    editMessage: (messageId: string, newContent: string) => void
    deleteMessage: (messageId: string) => void
    markAsRead: (messageId: string) => void
    addReaction: (messageId: string, emoji: string) => void
    removeReaction: (messageId: string, emoji: string) => void
    createSession: (participants: User[], isGroup?: boolean, groupName?: string) => string
    setActiveSession: (sessionId: string) => void
    clearError: () => void
    clearSessionHistory: (sessionId: string) => void
    clearAllHistory: () => void
    renameSession: (sessionId: string, newName: string) => void
    deleteSession: (sessionId: string) => void
    setTheme: (theme: "light" | "dark" | "system") => void
    addFeedback: (messageId: string, feedback: "positive" | "negative") => void
  }
>(
  persist(
    (set, get) => ({
      ...initialState,

      // Cập nhật phần gửi yêu cầu API để xử lý lỗi tốt hơn
      sendMessage: async (content, attachments = []) => {
        const { activeSessionId } = get()
        if (!activeSessionId) return

        // Set typing indicator
        set({ isTyping: true, error: null })

        // Create user message
        const userMessage: Message = {
          id: uuidv4(),
          content,
          role: "user",
          timestamp: new Date(),
          isRead: false,
          attachments: attachments.map((file) => ({
            id: uuidv4(),
            type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file",
            url: URL.createObjectURL(file),
            name: file.name,
            size: file.size,
          })),
        }

        // Update state with user message
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === activeSessionId
              ? {
                  ...session,
                  messages: [...session.messages, userMessage],
                  updatedAt: new Date(),
                }
              : session,
          ),
        }))

        try {
          // Kiểm tra kết nối mạng
          if (!navigator.onLine) {
            throw new Error("Không có kết nối mạng. Vui lòng kiểm tra kết nối internet của bạn và thử lại.")
          }

          // Chuẩn bị dữ liệu gửi đi
          const requestBody = JSON.stringify({
            messages: [...(get().sessions.find((s) => s.id === activeSessionId)?.messages || []), userMessage].map(
              (msg) => ({
                role: msg.role,
                content: msg.content,
              }),
            ),
          })

          console.log("Sending request to API...")

          // Sử dụng đường dẫn tuyệt đối để tránh vấn đề với đường dẫn tương đối
          const apiUrl = new URL("/api/chat", window.location.origin).toString()

          // Thêm timeout cho fetch để tránh chờ quá lâu
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 giây timeout

          // Gửi yêu cầu với cơ chế thử lại
          const response = await fetchWithRetry(
            apiUrl,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: requestBody,
              signal: controller.signal,
            },
            3,
          )

          clearTimeout(timeoutId)

          if (!response.ok) {
            let errorMessage = `Lỗi máy chủ: ${response.status} ${response.statusText}`

            try {
              const errorData = await response.json()
              if (errorData.error) {
                errorMessage = errorData.error
              }
            } catch (e) {
              // Không làm gì nếu không thể parse JSON
            }

            throw new Error(errorMessage)
          }

          let assistantContent = ""

          // Check if the response is a stream or JSON
          const contentType = response.headers.get("content-type") || ""

          if (contentType.includes("text/event-stream")) {
            // Handle streaming response
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()

            if (reader) {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                
                // Xử lý dữ liệu SSE (Server-Sent Events)
                // Tách các dòng dữ liệu
                const lines = chunk.split('\n')
                
                // Xử lý từng dòng
                for (const line of lines) {
                  // Bỏ qua các dòng trống
                  if (!line.trim()) continue
                  
                  // Kiểm tra nếu dòng bắt đầu bằng 'data: '
                  if (line.startsWith('data: ')) {
                    const data = line.substring(6) // Bỏ 'data: '
                    
                    // Kiểm tra nếu là thông báo kết thúc
                    if (data === '[DONE]') {
                      console.log('Stream completed')
                      continue
                    }
                    
                    try {
                      // Phân tích dữ liệu JSON
                      const parsedData = JSON.parse(data)
                      
                      // Lấy phần text từ dữ liệu
                      if (parsedData.text) {
                        assistantContent += parsedData.text
                      }
                    } catch (e) {
                      console.error('Error parsing SSE data:', e)
                      // Nếu không phân tích được, sử dụng dữ liệu thô
                      assistantContent += data
                    }
                  } else {
                    // Nếu không phải dạng SSE, thêm trực tiếp
                    assistantContent += line
                  }
                }

                // Update the assistant message as chunks arrive
                set((state) => {
                  const session = state.sessions.find((s) => s.id === activeSessionId)
                  if (!session) return state

                  const existingAssistantMessage = session.messages.find(
                    (m) => m.role === "assistant" && m.id === "temp-assistant-message",
                  )

                  if (existingAssistantMessage) {
                    // Update existing message
                    return {
                      sessions: state.sessions.map((s) =>
                        s.id === activeSessionId
                          ? {
                              ...s,
                              messages: s.messages.map((m) =>
                                m.id === "temp-assistant-message" ? { ...m, content: assistantContent } : m,
                              ),
                            }
                          : s,
                      ),
                    }
                  } else {
                    // Create new temporary message
                    return {
                      sessions: state.sessions.map((s) =>
                        s.id === activeSessionId
                          ? {
                              ...s,
                              messages: [
                                ...s.messages,
                                {
                                  id: "temp-assistant-message",
                                  content: assistantContent,
                                  role: "assistant",
                                  timestamp: new Date(),
                                  isRead: false,
                                },
                              ],
                            }
                          : s,
                      ),
                    }
                  }
                })
              }
            }
          } else {
            // Handle JSON response
            const data = await response.json()

            // Check if there's an error message from the server
            if (data.error) {
              throw new Error(data.error)
            }

            assistantContent = data.text || data.message || "Xin lỗi, tôi không thể trả lời ngay bây giờ."
          }

          // Create final assistant message with a permanent ID
          const assistantMessage: Message = {
            id: uuidv4(),
            content: assistantContent,
            role: "assistant",
            timestamp: new Date(),
            isRead: false,
          }

          // Update state with final assistant message
          set((state) => {
            const session = state.sessions.find((s) => s.id === activeSessionId)
            if (!session) return state

            // Filter out temporary message if it exists
            const filteredMessages = session.messages.filter((m) => m.id !== "temp-assistant-message")

            return {
              sessions: state.sessions.map((s) =>
                s.id === activeSessionId
                  ? {
                      ...s,
                      messages: [...filteredMessages, assistantMessage],
                      updatedAt: new Date(),
                    }
                  : s,
              ),
              isTyping: false,
              isConnected: true,
            }
          })
        } catch (error) {
          console.error("Error sending message:", error)

          // Xác định loại lỗi và đặt trạng thái kết nối phù hợp
          const isNetworkError =
            error instanceof TypeError ||
            (error instanceof Error &&
              (error.message.includes("Failed to fetch") ||
                error.message.includes("NetworkError") ||
                error.message.includes("Network request failed") ||
                error.message.includes("Không có kết nối mạng"))) ||
            !navigator.onLine ||
            (error instanceof DOMException && error.name === "AbortError")

          const errorMessage = error instanceof Error ? error.message : "Đã xảy ra lỗi khi gửi tin nhắn"

          set({
            error: errorMessage,
            isTyping: false,
            isConnected: !isNetworkError,
          })

          // Add a system message about the error
          const errorAssistantMessage: Message = {
            id: uuidv4(),
            content: isNetworkError
              ? "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn và thử lại sau."
              : `Xin lỗi, tôi đang gặp sự cố kết nối: ${errorMessage}. Vui lòng thử lại sau hoặc liên hệ với quản trị viên.`,
            role: "assistant",
            timestamp: new Date(),
            isRead: false,
          }

          set((state) => ({
            sessions: state.sessions.map((session) =>
              session.id === activeSessionId
                ? {
                    ...session,
                    messages: [...session.messages, errorAssistantMessage],
                    updatedAt: new Date(),
                  }
                : session,
            ),
          }))
        }
      },

      editMessage: (messageId, newContent) => {
        const { activeSessionId } = get()
        if (!activeSessionId) return

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === activeSessionId
              ? {
                  ...session,
                  messages: session.messages.map((message) =>
                    message.id === messageId ? { ...message, content: newContent, isEdited: true } : message,
                  ),
                  updatedAt: new Date(),
                }
              : session,
          ),
        }))
      },

      deleteMessage: (messageId) => {
        const { activeSessionId } = get()
        if (!activeSessionId) return

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === activeSessionId
              ? {
                  ...session,
                  messages: session.messages.filter((message) => message.id !== messageId),
                  updatedAt: new Date(),
                }
              : session,
          ),
        }))
      },

      markAsRead: (messageId) => {
        const { activeSessionId } = get()
        if (!activeSessionId) return

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === activeSessionId
              ? {
                  ...session,
                  messages: session.messages.map((message) =>
                    message.id === messageId ? { ...message, isRead: true } : message,
                  ),
                }
              : session,
          ),
        }))
      },

      addReaction: (messageId, emoji) => {
        const { activeSessionId } = get()
        if (!activeSessionId) return

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === activeSessionId
              ? {
                  ...session,
                  messages: session.messages.map((message) => {
                    if (message.id !== messageId) return message

                    const reactions = message.reactions || []
                    const existingReaction = reactions.find((r) => r.emoji === emoji)

                    if (existingReaction) {
                      return {
                        ...message,
                        reactions: reactions.map((r) =>
                          r.emoji === emoji
                            ? {
                                ...r,
                                count: r.count + 1,
                                users: [...r.users, currentUser.id],
                              }
                            : r,
                        ),
                      }
                    } else {
                      return {
                        ...message,
                        reactions: [...reactions, { emoji, count: 1, users: [currentUser.id] }],
                      }
                    }
                  }),
                }
              : session,
          ),
        }))
      },

      removeReaction: (messageId, emoji) => {
        const { activeSessionId } = get()
        if (!activeSessionId) return

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === activeSessionId
              ? {
                  ...session,
                  messages: session.messages.map((message) => {
                    if (message.id !== messageId || !message.reactions) return message

                    const updatedReactions = message.reactions
                      .map((r) => {
                        if (r.emoji !== emoji) return r

                        const updatedUsers = r.users.filter((id) => id !== currentUser.id)
                        return {
                          ...r,
                          count: r.count - 1,
                          users: updatedUsers,
                        }
                      })
                      .filter((r) => r.count > 0)

                    return {
                      ...message,
                      reactions: updatedReactions,
                    }
                  }),
                }
              : session,
          ),
        }))
      },

      createSession: (participants, isGroup = false, groupName) => {
        const newSessionId = uuidv4()

        set((state) => ({
          sessions: [
            ...state.sessions,
            {
              id: newSessionId,
              messages: [],
              participants: [...participants, currentUser],
              isGroup,
              groupName: groupName || `Cuộc trò chuyện mới (${new Date().toLocaleString("vi-VN")})`,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          activeSessionId: newSessionId,
        }))

        return newSessionId
      },

      setActiveSession: (sessionId) => {
        set({ activeSessionId: sessionId })
      },

      clearError: () => {
        set({ error: null })
      },

      // Thêm các chức năng mới
      clearSessionHistory: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: [],
                  updatedAt: new Date(),
                }
              : session,
          ),
        }))
      },

      clearAllHistory: () => {
        set((state) => ({
          sessions: state.sessions.map((session) => ({
            ...session,
            messages: [],
            updatedAt: new Date(),
          })),
        }))
      },

      renameSession: (sessionId, newName) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  groupName: newName,
                  updatedAt: new Date(),
                }
              : session,
          ),
        }))
      },

      deleteSession: (sessionId) => {
        const { activeSessionId, sessions } = get()

        // Nếu chỉ còn 1 session, không cho phép xóa
        if (sessions.length <= 1) {
          return
        }

        // Nếu xóa session đang active, chuyển sang session khác
        let newActiveSessionId = activeSessionId
        if (activeSessionId === sessionId) {
          const otherSession = sessions.find((s) => s.id !== sessionId)
          if (otherSession) {
            newActiveSessionId = otherSession.id
          }
        }

        set((state) => ({
          sessions: state.sessions.filter((session) => session.id !== sessionId),
          activeSessionId: newActiveSessionId,
        }))
      },

      setTheme: (theme) => {
        set({ theme })

        // Cập nhật theme cho document
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
      },

      addFeedback: (messageId, feedback) => {
        const { activeSessionId } = get()
        if (!activeSessionId) return

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === activeSessionId
              ? {
                  ...session,
                  messages: session.messages.map((message) =>
                    message.id === messageId ? { ...message, feedback } : message,
                  ),
                }
              : session,
          ),
        }))
      },
    }),
    {
      name: "laya-chat-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        theme: state.theme,
      }),
    },
  ),
)
