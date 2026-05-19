import type { LlmClient, LlmStreamEvent } from '../../domain/ports/llm-client.ts'

export class ChatUseCase {
  constructor(private readonly llm: LlmClient) {}

  complete(message: string, signal?: AbortSignal): Promise<string> {
    return this.llm.complete({
      messages: [{ role: 'user', content: message }],
      signal
    })
  }

  stream(message: string, signal?: AbortSignal): AsyncIterable<LlmStreamEvent> {
    return this.llm.stream({
      messages: [{ role: 'user', content: message }],
      signal
    })
  }
}
