import type { ChunkRepository } from '../../domain/ports/chunk-repository.ts'
import type { Embedder } from '../../domain/ports/embedder.ts'
import type { RankedChunk } from '../../domain/chunk.ts'
import { cosineSimilarity } from './cosine.ts'

const MIN_SIMILARITY = 0.65

export class SearchUseCase {
  constructor(
    private readonly chunks: ChunkRepository,
    private readonly embedder: Embedder
  ) {}

  async execute(query: string, k = 4): Promise<RankedChunk[]> {
    const queryEmbedding = await this.embedder.embed(query)
    const all = this.chunks.all()

    return all
      .map((c) => {
        const embedding = JSON.parse(c.embedding) as number[]
        const similarity = cosineSimilarity(queryEmbedding, embedding)
        return {
          source: c.source,
          section: c.section,
          content: c.content,
          similarity
        }
      })
      .filter((c) => c.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k)
  }
}
