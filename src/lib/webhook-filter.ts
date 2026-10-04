import { RE2 } from 're2-wasm'

export function compileTagFilter(pattern: string): RE2 {
  if (pattern.length > 512) throw new Error('Tag filter must be at most 512 characters.')
  return new RE2(pattern, 'u')
}

export function tagMatchesFilter(pattern: string, tag: string): boolean {
  if (tag.length > 1024) return false
  try {
    return compileTagFilter(pattern).test(tag)
  } catch {
    // Existing incompatible expressions fail closed, never fall back to JS.
    return false
  }
}
