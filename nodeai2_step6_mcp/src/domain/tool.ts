export interface ToolParameterSchema {
  type: 'object'
  required?: string[]
  properties: Record<string, { type: string; description?: string; default?: unknown }>
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: ToolParameterSchema
  }
}

export interface ToolCall {
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}
