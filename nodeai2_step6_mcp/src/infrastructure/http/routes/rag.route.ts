import type { FastifyInstance } from 'fastify'
import type { Container } from '../container.ts'
import { abortOnDisconnect, openSse } from '../sse.ts'

interface SearchBody {
  query: string
  k?: number
}

interface RagChatBody {
  message: string
}

export function ragRoute(container: Container) {
  return async (app: FastifyInstance): Promise<void> => {
    app.post('/rag/reindex', async (request) => {
      request.log.info('RAG: réindexation manuelle déclenchée')
      const { files, chunks } = await container.indexDocs.execute()
      return { indexed: true, files, chunks }
    })

    app.post<{ Body: SearchBody }>(
      '/rag/search',
      {
        schema: {
          body: {
            type: 'object',
            required: ['query'],
            properties: {
              query: { type: 'string', minLength: 1 },
              k: { type: 'integer', minimum: 1, maximum: 10, default: 4 }
            },
            additionalProperties: false
          }
        }
      },
      async (request) => {
        const { query, k = 4 } = request.body
        const results = await container.search.execute(query, k)
        return results.map((r) => ({
          source: r.source,
          section: r.section,
          content: r.content,
          similarity: Math.round(r.similarity * 1000) / 1000
        }))
      }
    )

    app.post<{ Body: RagChatBody }>(
      '/chat/rag',
      {
        schema: {
          body: {
            type: 'object',
            required: ['message'],
            properties: { message: { type: 'string', minLength: 1, maxLength: 4096 } },
            additionalProperties: false
          }
        }
      },
      async (request, reply) => {
        const { signal, cleanup } = abortOnDisconnect(request)
        const send = openSse(reply)

        try {
          for await (const event of container.ragChat.execute(request.body.message, signal)) {
            if (event.type === 'sources') send({ type: 'sources', sources: event.sources })
            else if (event.type === 'token') send({ type: 'token', value: event.value })
            else if (event.type === 'done') send({ type: 'done' })
          }
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            request.log.error(err, 'RAG streaming error')
            send({ type: 'error', message: (err as Error).message })
          }
        } finally {
          cleanup()
          reply.raw.end()
        }
      }
    )
  }
}
