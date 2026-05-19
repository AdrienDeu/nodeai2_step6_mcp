import type { ChunkRepository } from '../../domain/ports/chunk-repository.ts'
import type { DocsReader } from '../../domain/ports/docs-reader.ts'
import type { Embedder } from '../../domain/ports/embedder.ts'
import { chunkMarkdown } from './chunker.ts'

export interface IndexDocsResult {
  files: number
  chunks: number
}

export class IndexDocsUseCase {
  constructor(
    private readonly docs: DocsReader,
    private readonly chunks: ChunkRepository,
    private readonly embedder: Embedder
  ) {}

  async execute(): Promise<IndexDocsResult> {
    const files = await this.docs.list()
    this.chunks.deleteAll()

    let totalChunks = 0
    for (const file of files) {
      const content = await this.docs.read(file)
      const chunks = chunkMarkdown(content, file)
      for (const chunk of chunks) {
        const embedding = await this.embedder.embed(chunk.content)
        this.chunks.insert({
          source: chunk.source,
          section: chunk.section,
          position: chunk.position,
          content: chunk.content,
          embedding: JSON.stringify(embedding)
        })
        totalChunks++
      }
    }

    return { files: files.length, chunks: totalChunks }
  }
}
