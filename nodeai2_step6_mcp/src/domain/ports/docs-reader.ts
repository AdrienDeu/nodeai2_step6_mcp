export interface DocsReader {
  /** Returns the list of markdown filenames (relative to the docs root). */
  list(): Promise<string[]>

  /** Reads the full content of a markdown file. */
  read(filename: string): Promise<string>
}
