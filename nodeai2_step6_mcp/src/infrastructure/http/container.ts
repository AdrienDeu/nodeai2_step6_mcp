import type { Database } from 'better-sqlite3'

import { config } from '../config.ts'
import { openDatabase } from '../persistence/sqlite/db.ts'
import { SqliteConversationRepository } from '../persistence/sqlite/conversation.repository.ts'
import { SqliteChunkRepository } from '../persistence/sqlite/chunk.repository.ts'
import { OllamaClient } from '../llm/ollama-client.ts'
import { OllamaEmbedder } from '../embeddings/ollama-embedder.ts'
import { FileDocsReader } from '../docs/file-docs-reader.ts'
import { DefaultToolExecutor } from '../tools/registry.ts'

import { ChatUseCase } from '../../application/chat/chat.usecase.ts'
import {
  CreateConversationUseCase,
  DeleteConversationUseCase,
  GetConversationUseCase,
  ListConversationsUseCase,
  SendMessageInConversationUseCase
} from '../../application/conversations/conversation.usecases.ts'
import { RunAgentUseCase } from '../../application/agent/run-agent.usecase.ts'
import { IndexDocsUseCase } from '../../application/rag/index-docs.usecase.ts'
import { SearchUseCase } from '../../application/rag/search.usecase.ts'
import { RagChatUseCase } from '../../application/rag/rag-chat.usecase.ts'

export interface Container {
  db: Database
  chunkRepository: SqliteChunkRepository
  chat: ChatUseCase
  createConversation: CreateConversationUseCase
  listConversations: ListConversationsUseCase
  getConversation: GetConversationUseCase
  deleteConversation: DeleteConversationUseCase
  sendMessageInConversation: SendMessageInConversationUseCase
  runAgent: RunAgentUseCase
  indexDocs: IndexDocsUseCase
  search: SearchUseCase
  ragChat: RagChatUseCase
}

export function buildContainer(): Container {
  const db = openDatabase(config.dbPath)

  const conversationRepository = new SqliteConversationRepository(db)
  const chunkRepository = new SqliteChunkRepository(db)
  const docsReader = new FileDocsReader(config.docsDir)
  const llm = new OllamaClient(config.ollamaUrl, config.ollamaModel)
  const embedder = new OllamaEmbedder(config.ollamaUrl, config.embedModel)
  const tools = new DefaultToolExecutor(docsReader)

  const search = new SearchUseCase(chunkRepository, embedder)

  return {
    db,
    chunkRepository,
    chat: new ChatUseCase(llm),
    createConversation: new CreateConversationUseCase(conversationRepository),
    listConversations: new ListConversationsUseCase(conversationRepository),
    getConversation: new GetConversationUseCase(conversationRepository),
    deleteConversation: new DeleteConversationUseCase(conversationRepository),
    sendMessageInConversation: new SendMessageInConversationUseCase(conversationRepository, llm),
    runAgent: new RunAgentUseCase(llm, tools),
    indexDocs: new IndexDocsUseCase(docsReader, chunkRepository, embedder),
    search,
    ragChat: new RagChatUseCase(search, llm)
  }
}
