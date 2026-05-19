import type { LlmClient, ChatMessage } from '../../domain/ports/llm-client.ts'
import type { ToolExecutor } from '../../domain/ports/tool-executor.ts'
import type { ToolCall } from '../../domain/tool.ts'

const MAX_ITERATIONS = 5

export type AgentEvent =
  | { type: 'token'; value: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

export class RunAgentUseCase {
  constructor(
    private readonly llm: LlmClient,
    private readonly tools: ToolExecutor
  ) {}

  async *execute(userMessage: string, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
    const messages: ChatMessage[] = [{ role: 'user', content: userMessage }]

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      let assistantContent = ''
      const toolCalls: ToolCall[] = []

      for await (const event of this.llm.stream({
        messages,
        tools: this.tools.definitions,
        signal
      })) {
        if (event.type === 'token') {
          assistantContent += event.value
          yield { type: 'token', value: event.value }
        } else if (event.type === 'tool_calls') {
          toolCalls.push(...event.calls)
        }
      }

      messages.push({
        role: 'assistant',
        content: assistantContent,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {})
      })

      if (!toolCalls.length) {
        yield { type: 'done' }
        return
      }

      for (const tc of toolCalls) {
        const { name, arguments: args } = tc.function
        yield { type: 'tool_call', name, args }

        let result: string
        try {
          result = await this.tools.execute(name, args)
        } catch (err) {
          result = `Erreur: ${(err as Error).message}`
        }

        yield { type: 'tool_result', name, result }
        messages.push({ role: 'tool', content: String(result) })
      }
    }

    yield { type: 'done' }
  }
}
