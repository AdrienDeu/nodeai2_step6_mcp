import type { Chunk, NewChunk } from '../chunk.ts'

export interface ChunkRepository {
  insert(chunk: NewChunk): void
  all(): Chunk[]
  count(): number
  deleteAll(): void
}
