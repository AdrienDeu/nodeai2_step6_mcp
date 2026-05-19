import type { ChunkRepository } from '../../../domain/ports/chunk-repository.ts'
import type { Chunk, NewChunk } from '../../../domain/chunk.ts'

export class InMemoryChunkRepository implements ChunkRepository {
  private chunks: Chunk[] = []
  private nextId = 1

  insert(chunk: NewChunk): void {
    this.chunks.push({ id: this.nextId++, ...chunk })
  }

  all(): Chunk[] {
    return [...this.chunks]
  }

  count(): number {
    return this.chunks.length
  }

  deleteAll(): void {
    this.chunks = []
    this.nextId = 1
  }
}
