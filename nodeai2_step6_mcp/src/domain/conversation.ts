export type Role = 'user' | 'assistant' | 'system' | 'tool'

export interface Conversation {
  id: number
  title: string
  createdAt: string
}

export interface ConversationSummary extends Conversation {
  messageCount: number
}

export interface Message {
  id: number
  conversationId: number
  role: Role
  content: string
  createdAt: string
}
