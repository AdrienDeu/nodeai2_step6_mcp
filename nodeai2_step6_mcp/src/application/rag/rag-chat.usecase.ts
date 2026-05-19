import type { LlmClient, LlmStreamEvent } from '../../domain/ports/llm-client.ts'
import type { RankedChunk } from '../../domain/chunk.ts'
import { SearchUseCase } from './search.usecase.ts'

const RAG_SYSTEM_PROMPT = `Tu es un assistant qui répond UNIQUEMENT à partir du contexte ci-dessous.
Si le contexte ne contient pas la réponse, réponds exactement : "Je ne trouve pas l'information dans mes documents."
Cite tes sources entre crochets, format [fichier.md§section].`

export type RagEvent =
  | { type: 'sources'; sources: { source: string; section: string; similarity: number }[] }
  | { type: 'token'; value: string }
  | { type: 'done' }
  | { type: 'no_context' }

export class RagChatUseCase {
  constructor(
    private readonly search: SearchUseCase,
    private readonly llm: LlmClient
  ) {}

  async *execute(message: string, signal?: AbortSignal): AsyncGenerator<RagEvent> {
    const chunks: RankedChunk[] = await this.search.execute(message)

    if (chunks.length === 0) {
      yield { type: 'no_context' }
      yield { type: 'token', value: "Je ne trouve pas l'information dans mes documents." }
      yield { type: 'done' }
      return
    }

    yield {
      type: 'sources',
      sources: chunks.map((c) => ({
        source: c.source,
        section: c.section,
        similarity: Math.round(c.similarity * 1000) / 1000
      }))
    }

    const contextBlock = chunks.map((c) => `[${c.source}§${c.section}]\n${c.content}`).join('\n\n---\n\n')
    const systemMessage = `${RAG_SYSTEM_PROMPT}\n\nContexte :\n${contextBlock}`

    for await (const event of this.llm.stream({
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: message }
      ],
      signal
    })) {
      if (event.type === 'token') yield { type: 'token', value: event.value }
      else if (event.type === 'done') yield { type: 'done' }
    }
  }
}
