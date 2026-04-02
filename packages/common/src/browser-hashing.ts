import type { HexString } from './types.js'

function stableSortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortDeep(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, stableSortDeep(nested)]),
    )
  }

  return value
}

export function canonicalJsonBrowser(value: unknown): string {
  return JSON.stringify(stableSortDeep(value))
}

export async function sha256HexBrowser(input: string): Promise<HexString> {
  const encoded = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const hex = Array.from(new Uint8Array(digest))
    .map((chunk) => chunk.toString(16).padStart(2, '0'))
    .join('')
  return `0x${hex}` as HexString
}

export async function deriveCommitmentBrowser(label: string, payload: unknown): Promise<HexString> {
  return sha256HexBrowser(canonicalJsonBrowser({ label, payload }))
}
