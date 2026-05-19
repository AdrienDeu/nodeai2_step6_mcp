import fp from 'fastify-plugin'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { indexDocs } from '../rag/indexer.js'

const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), 'data.db')

async function dbPlugin(app) {
  const db = new Database(DB_PATH)

  // WAL : lectures et écritures simultanées sans conflit
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      title     TEXT    NOT NULL,
      createdAt TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      conversationId INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role           TEXT    NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content        TEXT    NOT NULL,
      createdAt      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      source    TEXT    NOT NULL,
      section   TEXT    NOT NULL,
      position  INTEGER NOT NULL,
      content   TEXT    NOT NULL,
      embedding TEXT    NOT NULL
    );
  `)

  // Préparer les requêtes une seule fois (performances + sécurité)
  const stmts = {
    createConv:   db.prepare('INSERT INTO conversations (title) VALUES (?) RETURNING *'),
    listConvs:    db.prepare(`
      SELECT c.id, c.title, c.createdAt,
             COUNT(m.id) AS messageCount
      FROM conversations c
      LEFT JOIN messages m ON m.conversationId = c.id
      GROUP BY c.id ORDER BY c.createdAt DESC
    `),
    getConv:      db.prepare('SELECT * FROM conversations WHERE id = ?'),
    deleteConv:   db.prepare('DELETE FROM conversations WHERE id = ?'),
    getMessages:  db.prepare('SELECT * FROM messages WHERE conversationId = ? ORDER BY id'),
    addMessage:   db.prepare('INSERT INTO messages (conversationId, role, content) VALUES (?, ?, ?) RETURNING *'),
    // RAG
    insertChunk:  db.prepare('INSERT INTO chunks (source, section, position, content, embedding) VALUES (?, ?, ?, ?, ?)'),
    getAllChunks: db.prepare('SELECT id, source, section, position, content, embedding FROM chunks'),
    countChunks:  db.prepare('SELECT COUNT(*) as count FROM chunks'),
  }

  app.decorate('db', db)
  app.decorate('stmts', stmts)

  // Fermeture propre de la DB à l'arrêt du serveur
  app.addHook('onClose', () => db.close())

  // Indexation au démarrage si la collection est vide
  app.addHook('onReady', async () => {
    const { count } = stmts.countChunks.get()
    if (count === 0) {
      app.log.info('RAG: aucun chunk en base, indexation des documents...')
      try {
        const { files, chunks } = await indexDocs(db, stmts)
        app.log.info(`RAG: Indexed ${chunks} chunks from ${files} files`)
      } catch (err) {
        app.log.warn({ err: err.message }, 'RAG: indexation échouée (docs vides ou Ollama indisponible)')
      }
    } else {
      app.log.info(`RAG: ${count} chunks déjà indexés`)
    }
  })
}

// fp() = fastify-plugin : le décorateur est visible en dehors de l'encapsulation
export default fp(dbPlugin, { name: 'db' })
