import { z } from 'zod'
import type { ToolExecutor } from '../../domain/ports/tool-executor.ts'
import type { DocsReader } from '../../domain/ports/docs-reader.ts'
import type { ToolDefinition } from '../../domain/tool.ts'

type ToolImpl = (args: unknown) => Promise<string> | string

interface ToolEntry {
  definition: ToolDefinition
  schema: z.ZodTypeAny
  impl: ToolImpl
}

export class DefaultToolExecutor implements ToolExecutor {
  private readonly tools: Map<string, ToolEntry>

  constructor(docs: DocsReader) {
    this.tools = new Map()
    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Retourne la météo actuelle pour une ville. Utilise une API publique.',
          parameters: {
            type: 'object',
            required: ['city'],
            properties: {
              city: { type: 'string', description: 'Nom de la ville (ex: Paris, Lyon, Bordeaux)' }
            }
          }
        }
      },
      schema: z.object({ city: z.string().min(1) }),
      impl: async (args) => {
        const { city } = args as { city: string }
        const url = `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%h+humidité`
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
        if (!res.ok) throw new Error(`Météo indisponible pour ${city}`)
        return res.text()
      }
    })

    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'calculator',
          description: 'Évalue une expression mathématique simple (ex: "2 + 3 * 4", "sqrt(16)").',
          parameters: {
            type: 'object',
            required: ['expression'],
            properties: {
              expression: { type: 'string', description: 'Expression mathématique à évaluer' }
            }
          }
        }
      },
      schema: z.object({ expression: z.string().min(1) }),
      impl: (args) => {
        const { expression } = args as { expression: string }
        const safe = /^[\d\s+\-*/().^%,a-z]+$/i
        if (!safe.test(expression)) throw new Error(`Expression non autorisée: ${expression}`)
        const mathFn = new Function(
          'Math',
          `"use strict"; return (${expression
            .replace(/\^/g, '**')
            .replace(/sqrt/g, 'Math.sqrt')
            .replace(/abs/g, 'Math.abs')
            .replace(/floor/g, 'Math.floor')
            .replace(/ceil/g, 'Math.ceil')
            .replace(/round/g, 'Math.round')
            .replace(/pi/gi, 'Math.PI')})`
        ) as (m: typeof Math) => unknown
        const result = mathFn(Math)
        if (typeof result !== 'number' || !isFinite(result)) throw new Error('Résultat invalide')
        return String(result)
      }
    })

    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'get_datetime',
          description: "Retourne la date et l'heure actuelle.",
          parameters: { type: 'object', properties: {} }
        }
      },
      schema: z.object({}).passthrough(),
      impl: () => new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
    })

    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'read_local_file',
          description: "Lit le contenu d'un fichier dans le dossier ./docs du projet.",
          parameters: {
            type: 'object',
            required: ['filename'],
            properties: {
              filename: { type: 'string', description: 'Nom du fichier dans ./docs (ex: "notes.md")' }
            }
          }
        }
      },
      schema: z.object({ filename: z.string().min(1) }),
      impl: async (args) => {
        const { filename } = args as { filename: string }
        const content = await docs.read(filename)
        return content.slice(0, 4000)
      }
    })
  }

  private register(entry: ToolEntry): void {
    this.tools.set(entry.definition.function.name, entry)
  }

  get definitions(): ToolDefinition[] {
    return [...this.tools.values()].map((e) => e.definition)
  }

  async execute(name: string, rawArgs: unknown): Promise<string> {
    const entry = this.tools.get(name)
    if (!entry) throw new Error(`Tool inconnu: ${name}`)

    const parsed = entry.schema.safeParse(rawArgs)
    if (!parsed.success) {
      throw new Error(`Arguments invalides pour ${name}: ${parsed.error.message}`)
    }
    return entry.impl(parsed.data)
  }
}
