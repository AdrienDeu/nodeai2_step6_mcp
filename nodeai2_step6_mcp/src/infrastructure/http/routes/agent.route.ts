import type { FastifyInstance } from 'fastify'
import type { Container } from '../container.ts'
import { abortOnDisconnect, openSse } from '../sse.ts'

const agentBodySchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', minLength: 1, maxLength: 4096 }
  },
  additionalProperties: false
} as const

interface AgentBody {
  message: string
}

export function agentRoute(container: Container) {
  return async (app: FastifyInstance): Promise<void> => {
    app.post<{ Body: AgentBody }>(
      '/chat/agent',
      { schema: { body: agentBodySchema } },
      async (request, reply) => {
        const { signal, cleanup } = abortOnDisconnect(request)
        const send = openSse(reply)

        try {
          for await (const event of container.runAgent.execute(request.body.message, signal)) {
            if (event.type === 'token') send({ type: 'token', value: event.value })
            else if (event.type === 'tool_call') {
              request.log.info({ name: event.name, args: event.args }, 'Tool call')
              send({ type: 'tool_call', name: event.name, args: event.args })
            } else if (event.type === 'tool_result') {
              request.log.info({ name: event.name, result: event.result }, 'Tool result')
              send({ type: 'tool_result', name: event.name, result: event.result })
            } else if (event.type === 'done') {
              send({ type: 'done' })
            } else if (event.type === 'error') {
              send({ type: 'error', message: event.message })
            }
          }
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            request.log.error(err, 'Agent error')
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
