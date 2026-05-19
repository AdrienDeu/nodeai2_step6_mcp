/**
 * MCP server (Model Context Protocol) — stdio transport.
 * Wires the domain use-cases to the @modelcontextprotocol/sdk Server.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'

import { config } from '../config.ts'
import { FileDocsReader } from '../docs/file-docs-reader.ts'
import { OllamaEmbedder } from '../embeddings/ollama-embedder.ts'
import { InMemoryChunkRepository } from '../persistence/in-memory/chunk.repository.ts'
import { DefaultToolExecutor } from '../tools/registry.ts'
import { IndexDocsUseCase } from '../../application/rag/index-docs.usecase.ts'
import { SearchUseCase } from '../../application/rag/search.usecase.ts'

const docsReader = new FileDocsReader(config.docsDir)
const embedder = new OllamaEmbedder(config.ollamaUrl, config.embedModel)
const chunkRepository = new InMemoryChunkRepository()
const indexDocs = new IndexDocsUseCase(docsReader, chunkRepository, embedder)
const search = new SearchUseCase(chunkRepository, embedder)
const toolExecutor = new DefaultToolExecutor(docsReader)

let indexed = false
async function ensureIndexed(): Promise<void> {
  if (indexed) return
  await indexDocs.execute()
  indexed = true
}

const MCP_TOOLS = [
  ...toolExecutor.definitions.map((d) => ({
    name: d.function.name,
    description: d.function.description,
    inputSchema: d.function.parameters
  })),
  {
    name: 'search_docs',
    description: 'Recherche les passages les plus pertinents dans la documentation Markdown.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Question ou sujet à rechercher' },
        k: { type: 'number', description: 'Nombre de résultats (défaut: 3)', default: 3 }
      }
    }
  }
]

const server = new Server(
  { name: 'mongpt', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: MCP_TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  process.stderr.write(`[MCP] tool_call: ${name} ${JSON.stringify(args)}\n`)

  try {
    let result: string
    if (name === 'search_docs') {
      await ensureIndexed()
      const { query, k = 3 } = (args ?? {}) as { query: string; k?: number }
      const results = await search.execute(query, k)
      result =
        results.length === 0
          ? 'Aucun document pertinent trouvé.'
          : results
              .map(
                (r) =>
                  `[${r.source}§${r.section}] (similarité: ${Math.round(r.similarity * 1000) / 1000})\n${r.content}`
              )
              .join('\n\n---\n\n')
    } else {
      result = await toolExecutor.execute(name, args)
    }

    process.stderr.write(`[MCP] tool_result: ${String(result).slice(0, 100)}\n`)
    return {
      content: [{ type: 'text', text: String(result) }],
      isError: false
    }
  } catch (err) {
    const message = (err as Error).message
    process.stderr.write(`[MCP] tool_error: ${message}\n`)
    return {
      content: [{ type: 'text', text: `Erreur: ${message}` }],
      isError: true
    }
  }
})

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const files = await docsReader.list()
  return {
    resources: files.map((f) => ({
      uri: `docs://${f}`,
      name: f,
      description: `Document Markdown: ${f}`,
      mimeType: 'text/markdown'
    }))
  }
})

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const filename = request.params.uri.replace('docs://', '')
  const content = await docsReader.read(filename)
  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: 'text/markdown',
        text: content
      }
    ]
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
process.stderr.write('[MCP] Serveur mongpt démarré — en attente sur stdin\n')
