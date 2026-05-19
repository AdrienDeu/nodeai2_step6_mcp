import { getEmbedding } from './indexer.js'

const MIN_SIMILARITY = 0.65

/**
 * Similarité cosinus entre deux vecteurs.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} valeur entre -1 et 1 (1 = identique)
 */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Retrouve les K chunks les plus pertinents pour une query.
 * @param {object} stmts - Prepared statements
 * @param {string} query - Question de l'utilisateur
 * @param {number} k - Nombre de résultats
 * @returns {Promise<{source, section, content, similarity}[]>}
 */
export async function retrieve(stmts, query, k = 4) {
  const queryEmbedding = await getEmbedding(query)

  // Récupère tous les chunks avec leurs embeddings
  const chunks = stmts.getAllChunks.all()

  // Calcule la similarité cosinus pour chaque chunk
  const ranked = chunks
    .map(chunk => {
      const embedding = JSON.parse(chunk.embedding)
      const similarity = cosineSimilarity(queryEmbedding, embedding)
      return { ...chunk, similarity }
    })
    .filter(c => c.similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)

  return ranked
}
