import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import sensible from '@fastify/sensible'

import { config } from '../config.ts'
import { buildContainer, type Container } from './container.ts'
import { healthRoute } from './routes/health.route.ts'
import { chatRoute } from './routes/chat.route.ts'
import { conversationsRoute } from './routes/conversations.route.ts'
import { agentRoute } from './routes/agent.route.ts'
import { ragRoute } from './routes/rag.route.ts'

export interface BuiltApp {
  app: FastifyInstance
  container: Container
}

export async function buildApp(opts: FastifyServerOptions = {}): Promise<BuiltApp> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        config.nodeEnv !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
          : undefined
    },
    ...opts
  })

  const container = buildContainer()

  await app.register(sensible)

  await app.register(healthRoute)
  await app.register(chatRoute(container))
  await app.register(conversationsRoute(container))
  await app.register(agentRoute(container))
  await app.register(ragRoute(container))

  app.addHook('onClose', () => {
    container.db.close()
  })

  app.addHook('onReady', async () => {
    const count = container.chunkRepository.count()
    if (count === 0) {
      app.log.info('RAG: aucun chunk en base, indexation des documents...')
      try {
        const { files, chunks } = await container.indexDocs.execute()
        app.log.info(`RAG: Indexed ${chunks} chunks from ${files} files`)
      } catch (err) {
        app.log.warn(
          { err: (err as Error).message },
          'RAG: indexation échouée (docs vides ou Ollama indisponible)'
        )
      }
    } else {
      app.log.info(`RAG: ${count} chunks déjà indexés`)
    }
  })

  return { app, container }
}
