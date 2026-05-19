import { join } from 'node:path'

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: '0.0.0.0',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  nodeEnv: process.env.NODE_ENV,

  ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'llama3.2',
  embedModel: process.env.EMBED_MODEL ?? 'nomic-embed-text',

  dbPath: process.env.DB_PATH ?? join(process.cwd(), 'data.db'),
  docsDir: process.env.DOCS_DIR ?? join(process.cwd(), 'docs')
} as const
