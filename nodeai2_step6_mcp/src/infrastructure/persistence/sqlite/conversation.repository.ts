import type { Database, Statement } from 'better-sqlite3'
import type { ConversationRepository } from '../../../domain/ports/conversation-repository.ts'
import type { Conversation, ConversationSummary, Message, Role } from '../../../domain/conversation.ts'

export class SqliteConversationRepository implements ConversationRepository {
  private readonly createStmt: Statement
  private readonly listStmt: Statement
  private readonly getStmt: Statement
  private readonly deleteStmt: Statement
  private readonly updateTitleStmt: Statement
  private readonly getMessagesStmt: Statement
  private readonly addMessageStmt: Statement

  constructor(db: Database) {
    this.createStmt = db.prepare('INSERT INTO conversations (title) VALUES (?) RETURNING *')
    this.listStmt = db.prepare(`
      SELECT c.id, c.title, c.createdAt,
             COUNT(m.id) AS messageCount
      FROM conversations c
      LEFT JOIN messages m ON m.conversationId = c.id
      GROUP BY c.id ORDER BY c.createdAt DESC
    `)
    this.getStmt = db.prepare('SELECT * FROM conversations WHERE id = ?')
    this.deleteStmt = db.prepare('DELETE FROM conversations WHERE id = ?')
    this.updateTitleStmt = db.prepare('UPDATE conversations SET title = ? WHERE id = ?')
    this.getMessagesStmt = db.prepare('SELECT * FROM messages WHERE conversationId = ? ORDER BY id')
    this.addMessageStmt = db.prepare(
      'INSERT INTO messages (conversationId, role, content) VALUES (?, ?, ?) RETURNING *'
    )
  }

  create(title: string): Conversation {
    return this.createStmt.get(title) as Conversation
  }

  list(): ConversationSummary[] {
    return this.listStmt.all() as ConversationSummary[]
  }

  get(id: number): Conversation | undefined {
    return this.getStmt.get(id) as Conversation | undefined
  }

  delete(id: number): boolean {
    return this.deleteStmt.run(id).changes > 0
  }

  updateTitle(id: number, title: string): void {
    this.updateTitleStmt.run(title, id)
  }

  getMessages(conversationId: number): Message[] {
    return this.getMessagesStmt.all(conversationId) as Message[]
  }

  addMessage(conversationId: number, role: Role, content: string): Message {
    return this.addMessageStmt.get(conversationId, role, content) as Message
  }
}
