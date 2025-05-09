export interface User {
  id: string
  name: string
  avatar?: string
  isOnline?: boolean
  lastSeen?: Date
}

export interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  isEdited?: boolean
  isRead?: boolean
  attachments?: Attachment[]
  reactions?: Reaction[]
  feedback?: "positive" | "negative"
}

export interface Attachment {
  id: string
  type: "image" | "video" | "file"
  url: string
  name: string
  size?: number
  thumbnailUrl?: string
}

export interface Reaction {
  emoji: string
  count: number
  users: string[] // User IDs who reacted
}

export interface ChatSession {
  id: string
  messages: Message[]
  participants: User[]
  isGroup?: boolean
  groupName?: string
  createdAt: Date
  updatedAt: Date
}

export interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string | null
  isConnected: boolean
  isTyping: boolean
  error: string | null
  theme: "light" | "dark" | "system"
}
