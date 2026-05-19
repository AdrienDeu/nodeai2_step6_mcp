import type { FastifyReply, FastifyRequest } from 'fastify'

export function openSse(reply: FastifyReply): (payload: unknown) => void {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  return (payload: unknown) => reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`)
}

export function abortOnDisconnect(request: FastifyRequest): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController()
  const onClose = () => controller.abort()
  request.socket.once('close', onClose)
  return {
    signal: controller.signal,
    cleanup: () => request.socket.removeListener('close', onClose)
  }
}
