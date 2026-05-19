import type { Role } from '../conversation.ts'
import type { ToolCall, ToolDefinition } from '../tool.ts'

export interface ChatMessage {
  role: Role
  content: string
  tool_calls?: ToolCall[]
}

export type LlmStreamEvent =
  | { type: 'token'; value: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'done' }

export interface LlmChatOptions {
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  signal?: AbortSignal
}

export interface LlmClient {
  /** One-shot completion (no streaming). */
  complete(opts: LlmChatOptions): Promise<string>

  /** Streaming completion. Emits tokens and (optionally) batched tool_calls. */
  stream(opts: LlmChatOptions): AsyncIterable<LlmStreamEvent>
}
