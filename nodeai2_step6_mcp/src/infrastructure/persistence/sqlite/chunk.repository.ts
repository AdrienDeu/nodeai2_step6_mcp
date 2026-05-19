import type { Database, Statement } from 'better-sqlite3'
import type { ChunkRepository } from '../../../domain/ports/chunk-repository.ts'
import type { Chunk, NewChunk } from '../../../domain/chunk.ts'

export class SqliteChunkRepository implements ChunkRepository {
  private readonly insertStmt: Statement
  private readonly allStmt: Statement
  private readonly countStmt: Statement
  private readonly deleteAllStmt: Statement

  constructor(db: Database) {
    this.insertStmt = db.prepare(
      'INSERT INTO chunks (source, section, position, content, embedding) VALUES (?, ?, ?, ?, ?)'
    )
    this.allStmt = db.prepare('SELECT id, source, section, position, content, embedding FROM chunks')
    this.countStmt = db.prepare('SELECT COUNT(*) as count FROM chunks')
    this.deleteAllStmt = db.prepare('DELETE FROM chunks')
  }

  insert(chunk: NewChunk): void {
    this.insertStmt.run(chunk.source, chunk.section, chunk.position, chunk.content, chunk.embedding)
  }

  all(): Chunk[] {
    return this.allStmt.all() as Chunk[]
  }

  count(): number {
    return (this.countStmt.get() as { count: number }).count
  }

  deleteAll(): void {
    this.deleteAllStmt.run()
  }
}
