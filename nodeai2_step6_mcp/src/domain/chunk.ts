export interface Chunk {
  id: number
  source: string
  section: string
  position: number
  content: string
  embedding: string
}

export interface NewChunk {
  source: string
  section: string
  position: number
  content: string
  embedding: string
}

export interface RankedChunk {
  source: string
  section: string
  content: string
  similarity: number
}
