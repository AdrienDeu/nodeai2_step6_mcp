import type { LlmClient, LlmChatOptions, LlmStreamEvent } from '../../domain/ports/llm-client.ts'
import type { ToolCall } from '../../domain/tool.ts'
import { LlmError } from '../../domain/errors.ts'

interface OllamaStreamLine {
  message?: {
    content?: string
    tool_calls?: ToolCall[]
  }
  done?: boolean
}

export class OllamaClient implements LlmClient {
  constructor(
    private readonly url: string,
    private readonly model: string
  ) {}

  async complete(opts: LlmChatOptions): Promise<string> {
    const res = await fetch(`${this.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: opts.signal,
      body: JSON.stringify({
        model: this.model,
        messages: opts.messages,
        ...(opts.tools ? { tools: opts.tools } : {}),
        stream: false
      })
    })

    if (!res.ok) {
      throw new LlmError(`Ollama request failed: ${await res.text()}`, res.status)
    }

    const data = (await res.json()) as { message: { content: string } }
    return data.message.content
  }

  async *stream(opts: LlmChatOptions): AsyncGenerator<LlmStreamEvent> {
    const res = await fetch(`${this.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: opts.signal,
      body: JSON.stringify({
        model: this.model,
        messages: opts.messages,
        ...(opts.tools ? { tools: opts.tools } : {}),
        stream: true
      })
    })

    if (!res.ok || !res.body) {
      throw new LlmError(`Ollama request failed: ${await res.text()}`, res.status)
    }

    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      const lines = Buffer.from(chunk).toString('utf8').split('\n').filter(Boolean)
      for (const line of lines) {
        const parsed = JSON.parse(line) as OllamaStreamLine

        if (parsed.message?.content) {
          yield { type: 'token', value: parsed.message.content }
        }
        if (parsed.message?.tool_calls?.length) {
          yield { type: 'tool_calls', calls: parsed.message.tool_calls }
        }
        if (parsed.done) {
          yield { type: 'done' }
        }
      }
    }
  }
}
