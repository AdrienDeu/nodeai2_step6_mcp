import { readdir, readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import type { DocsReader } from '../../domain/ports/docs-reader.ts'

export class FileDocsReader implements DocsReader {
  private readonly root: string

  constructor(root: string) {
    this.root = resolve(root)
  }

  async list(): Promise<string[]> {
    const entries = await readdir(this.root, { recursive: true })
    return entries.filter((f) => extname(f) === '.md')
  }

  async read(filename: string): Promise<string> {
    const target = normalize(join(this.root, filename))
    if (!target.startsWith(this.root + '/') && target !== this.root) {
      throw new Error(`Accès refusé : ${filename} est en dehors de ${this.root}`)
    }
    return readFile(target, 'utf8')
  }
}
