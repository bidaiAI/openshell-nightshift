import { createHash, randomUUID } from 'node:crypto'
import type { HexString } from './types.js'

export function stableSortDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => stableSortDeep(item)) as T
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, inner]) => [key, stableSortDeep(inner)] as const)

    return Object.fromEntries(entries) as T
  }

  return value
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(stableSortDeep(value))
}

export function sha256Hex(input: string | Uint8Array): HexString {
  return `0x${createHash('sha256').update(input).digest('hex')}` as HexString
}

export function hashCanonicalJson(value: unknown): HexString {
  return sha256Hex(canonicalJson(value))
}

export function hashParts(parts: readonly unknown[]): HexString {
  return hashCanonicalJson(parts)
}

export function deriveCommitment(label: string, payload: unknown): HexString {
  return hashCanonicalJson({ label, payload })
}

export function generateId(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

export function toHexCommitment(value: string): HexString {
  return sha256Hex(value)
}
