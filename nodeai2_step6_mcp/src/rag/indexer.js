import { readFile, readdir } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { chunkMarkdown } from './chunker.js'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const EMBED_MODEL = process.env.EMBED_MODEL ?? 'nomic-embed-text'
const DOCS_DIR = join(process.cwd(), 'docs')

/**
 * Calcule l'embedding d'un texte via Ollama.
 * @returns {number[]}
 */
export async function getEmbedding(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text })
  })
  if (!res.ok) throw new Error(`Ollama embeddings error: ${res.status}`)
  const data = await res.json()
  return data.embedding
}

/**
 * Scanne ./docs, chunke tous les .md et stocke leurs embeddings dans SQLite.
 * @param {import('better-sqlite3').Database} db
 * @param {object} stmts
 */
export async function indexDocs(db, stmts) {
  const files = await readdir(DOCS_DIR, { recursive: true })
  const markdownFiles = files.filter(f => extname(f) === '.md')

  let totalChunks = 0

  // Vide les chunks existants avant réindexation
  db.prepare('DELETE FROM chunks').run()

  for (const file of markdownFiles) {
    const fullPath = join(DOCS_DIR, file)
    const content = await readFile(fullPath, 'utf8')
    const chunks = chunkMarkdown(content, file)

    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk.content)
      stmts.insertChunk.run(
        chunk.source,
        chunk.section,
        chunk.position,
        chunk.content,
        // Stockage du vecteur sous forme de JSON pour sqlite-vec
        JSON.stringify(embedding)
      )
      totalChunks++
    }
  }

  return { files: markdownFiles.length, chunks: totalChunks }
}
