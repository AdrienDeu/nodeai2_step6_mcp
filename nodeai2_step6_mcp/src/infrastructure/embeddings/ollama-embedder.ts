import type { Embedder } from '../../domain/ports/embedder.ts'
import { LlmError } from '../../domain/errors.ts'

export class OllamaEmbedder implements Embedder {
  constructor(
    private readonly url: string,
    private readonly model: string
  ) {}

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.url}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text })
    })

    if (!res.ok) {
      throw new LlmError(`Ollama embeddings error: ${res.status}`, res.status)
    }

    const data = (await res.json()) as { embedding: number[] }
    return data.embedding
  }
}
