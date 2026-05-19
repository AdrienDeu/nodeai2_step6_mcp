import type { FastifyInstance } from 'fastify'
import type { Container } from '../container.ts'
import { abortOnDisconnect, openSse } from '../sse.ts'

const chatBodySchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', minLength: 1, maxLength: 4096 }
  },
  additionalProperties: false
} as const

interface ChatBody {
  message: string
}

export function chatRoute(container: Container) {
  return async (app: FastifyInstance): Promise<void> => {
    app.post<{ Body: ChatBody }>(
      '/chat',
      {
        schema: {
          body: chatBodySchema,
          response: {
            200: {
              type: 'object',
              properties: { response: { type: 'string' } }
            }
          }
        }
      },
      async (request, reply) => {
        try {
          const response = await container.chat.complete(request.body.message)
          return { response }
        } catch (err) {
          request.log.error(err, 'Chat error')
          return reply.status(502).send({ error: 'Ollama request failed' })
        }
      }
    )

    app.post<{ Body: ChatBody }>('/chat/stream', { schema: { body: chatBodySchema } }, async (request, reply) => {
      const { signal, cleanup } = abortOnDisconnect(request)
      const send = openSse(reply)

      try {
        for await (const event of container.chat.stream(request.body.message, signal)) {
          if (event.type === 'token') send({ type: 'token', value: event.value })
          else if (event.type === 'done') send({ type: 'done' })
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          request.log.error(err, 'Streaming error')
          send({ type: 'error', message: (err as Error).message })
        }
      } finally {
        cleanup()
        reply.raw.end()
      }
    })
  }
}
