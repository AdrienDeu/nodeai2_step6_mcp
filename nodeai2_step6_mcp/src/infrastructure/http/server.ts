import { buildApp } from './app.ts'
import { config } from '../config.ts'

const { app } = await buildApp()

try {
  await app.listen({ port: config.port, host: config.host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
