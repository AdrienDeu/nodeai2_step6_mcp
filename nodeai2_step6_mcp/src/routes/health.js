/** @param {import('fastify').FastifyInstance} app */
export async function healthRoute(app) {
  app.get('/health', { schema: { response: { 200: { type: 'object', properties: { status: { type: 'string' } } } } } }, async () => {
    return { status: 'ok' }
  })
}
