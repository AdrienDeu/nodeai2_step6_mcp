import type { ToolDefinition } from '../tool.ts'

export interface ToolExecutor {
  readonly definitions: ToolDefinition[]
  execute(name: string, args: unknown): Promise<string>
}
