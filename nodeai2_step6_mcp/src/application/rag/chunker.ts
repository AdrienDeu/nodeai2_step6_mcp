import matter from 'gray-matter'

const CHUNK_SIZE = 500
const OVERLAP = 50

export interface MarkdownChunk {
  source: string
  section: string
  position: number
  content: string
}

export function chunkMarkdown(content: string, source: string): MarkdownChunk[] {
  const { data: frontmatter, content: body } = matter(content)
  const title = (frontmatter as { title?: string }).title ?? source

  const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)

  const chunks: MarkdownChunk[] = []
  let currentChunk = ''
  let currentSection = title
  let position = 0

  const flush = () => {
    if (currentChunk.trim()) {
      chunks.push({
        source,
        section: currentSection,
        position: position++,
        content: currentChunk.trim()
      })
    }
  }

  for (const paragraph of paragraphs) {
    const headingMatch = paragraph.match(/^#{1,3}\s+(.+)/)
    if (headingMatch) currentSection = headingMatch[1]

    const approxTokens = (currentChunk + paragraph).length / 4

    if (approxTokens > CHUNK_SIZE && currentChunk) {
      flush()
      const overlapChars = OVERLAP * 4
      currentChunk = currentChunk.slice(-overlapChars) + '\n\n' + paragraph
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph
    }
  }

  flush()
  return chunks
}
