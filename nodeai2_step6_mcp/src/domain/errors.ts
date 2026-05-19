export class NotFoundError extends Error {
  constructor(public readonly resource: string, public readonly id: string | number) {
    super(`${resource} ${id} introuvable`)
    this.name = 'NotFoundError'
  }
}

export class LlmError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'LlmError'
  }
}
