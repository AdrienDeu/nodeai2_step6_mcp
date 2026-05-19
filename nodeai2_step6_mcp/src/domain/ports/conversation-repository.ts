import type { Conversation, ConversationSummary, Message, Role } from '../conversation.ts'

export interface ConversationRepository {
  create(title: string): Conversation
  list(): ConversationSummary[]
  get(id: number): Conversation | undefined
  delete(id: number): boolean
  updateTitle(id: number, title: string): void

  getMessages(conversationId: number): Message[]
  addMessage(conversationId: number, role: Role, content: string): Message
}
