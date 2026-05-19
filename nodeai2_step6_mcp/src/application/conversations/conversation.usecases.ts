import type { ConversationRepository } from '../../domain/ports/conversation-repository.ts'
import type { LlmClient, LlmStreamEvent, ChatMessage } from '../../domain/ports/llm-client.ts'
import type { Conversation, ConversationSummary, Message } from '../../domain/conversation.ts'
import { NotFoundError } from '../../domain/errors.ts'

export class CreateConversationUseCase {
  constructor(private readonly repo: ConversationRepository) {}

  execute(title = 'Nouvelle conversation'): Conversation {
    return this.repo.create(title)
  }
}

export class ListConversationsUseCase {
  constructor(private readonly repo: ConversationRepository) {}

  execute(): ConversationSummary[] {
    return this.repo.list()
  }
}

export class GetConversationUseCase {
  constructor(private readonly repo: ConversationRepository) {}

  execute(id: number): Conversation & { messages: Message[] } {
    const conv = this.repo.get(id)
    if (!conv) throw new NotFoundError('Conversation', id)
    const messages = this.repo.getMessages(id)
    return { ...conv, messages }
  }
}

export class DeleteConversationUseCase {
  constructor(private readonly repo: ConversationRepository) {}

  execute(id: number): void {
    const ok = this.repo.delete(id)
    if (!ok) throw new NotFoundError('Conversation', id)
  }
}

export class SendMessageInConversationUseCase {
  constructor(
    private readonly repo: ConversationRepository,
    private readonly llm: LlmClient
  ) {}

  /**
   * Persist user message, stream assistant tokens, persist assistant message
   * once the stream is done. Yields raw LLM events to the caller.
   */
  async *execute(conversationId: number, message: string, signal?: AbortSignal): AsyncGenerator<LlmStreamEvent> {
    const conv = this.repo.get(conversationId)
    if (!conv) throw new NotFoundError('Conversation', conversationId)

    const history = this.repo.getMessages(conversationId)
    if (history.length === 0) {
      this.repo.updateTitle(conversationId, message.slice(0, 60))
    }

    this.repo.addMessage(conversationId, 'user', message)

    const updatedHistory = this.repo.getMessages(conversationId)
    const llmMessages: ChatMessage[] = updatedHistory.map((m) => ({ role: m.role, content: m.content }))

    let full = ''
    for await (const event of this.llm.stream({ messages: llmMessages, signal })) {
      if (event.type === 'token') {
        full += event.value
      }
      if (event.type === 'done') {
        this.repo.addMessage(conversationId, 'assistant', full)
      }
      yield event
    }
  }
}
