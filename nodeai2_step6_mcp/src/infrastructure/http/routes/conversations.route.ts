import type { FastifyInstance } from 'fastify'
import type { Container } from '../container.ts'
import { NotFoundError } from '../../../domain/errors.ts'
import { abortOnDisconnect, openSse } from '../sse.ts'

const messageSchema = {
  $id: 'Message',
  type: 'object',
  properties: {
    id: { type: 'integer' },
    conversationId: { type: 'integer' },
    role: { type: 'string' },
    content: { type: 'string' },
    createdAt: { type: 'string' }
  }
} as const

const conversationSchema = {
  $id: 'Conversation',
  type: 'object',
  properties: {
    id: { type: 'integer' },
    title: { type: 'string' },
    createdAt: { type: 'string' },
    messageCount: { type: 'integer' }
  }
} as const

interface IdParams {
  id: number
}

interface MessageBody {
  message: string
}

export function conversationsRoute(container: Container) {
  return async (app: FastifyInstance): Promise<void> => {
    app.addSchema(messageSchema)
    app.addSchema(conversationSchema)

    app.post(
      '/conversations',
      {
        schema: { response: { 201: { $ref: 'Conversation#' } } }
      },
      async (_request, reply) => {
        const conv = container.createConversation.execute()
        return reply.status(201).send(conv)
      }
    )

    app.get(
      '/conversations',
      {
        schema: { response: { 200: { type: 'array', items: { $ref: 'Conversation#' } } } }
      },
      async () => container.listConversations.execute()
    )

    app.get<{ Params: IdParams }>(
      '/conversations/:id',
      {
        schema: {
          params: { type: 'object', properties: { id: { type: 'integer' } } },
          response: {
            200: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                title: { type: 'string' },
                createdAt: { type: 'string' },
                messages: { type: 'array', items: { $ref: 'Message#' } }
              }
            }
          }
        }
      },
      async (request, reply) => {
        try {
          return container.getConversation.execute(request.params.id)
        } catch (err) {
          if (err instanceof NotFoundError) return reply.notFound(err.message)
          throw err
        }
      }
    )

    app.delete<{ Params: IdParams }>(
      '/conversations/:id',
      {
        schema: { params: { type: 'object', properties: { id: { type: 'integer' } } } }
      },
      async (request, reply) => {
        try {
          container.deleteConversation.execute(request.params.id)
          return reply.status(204).send()
        } catch (err) {
          if (err instanceof NotFoundError) return reply.notFound(err.message)
          throw err
        }
      }
    )

    app.post<{ Params: IdParams; Body: MessageBody }>(
      '/conversations/:id/messages',
      {
        schema: {
          params: { type: 'object', properties: { id: { type: 'integer' } } },
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
        try {
          const stream = container.sendMessageInConversation.execute(
            request.params.id,
            request.body.message,
            signal
          )
          const send = openSse(reply)
          try {
            for await (const event of stream) {
              if (event.type === 'token') send({ type: 'token', value: event.value })
              else if (event.type === 'done') send({ type: 'done' })
            }
          } catch (err) {
            if ((err as Error).name !== 'AbortError') {
              request.log.error(err, 'Streaming error')
              send({ type: 'error', message: (err as Error).message })
            }
          } finally {
            reply.raw.end()
          }
        } catch (err) {
          if (err instanceof NotFoundError) return reply.notFound(err.message)
          throw err
        } finally {
          cleanup()
        }
      }
    )
  }
}
