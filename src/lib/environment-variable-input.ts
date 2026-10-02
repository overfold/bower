export function parseEnvironmentVariableRows(value: FormDataEntryValue | null) {
  let input: unknown
  try { input = JSON.parse(String(value ?? '[]')) } catch { throw new Error('Environment variables must be valid JSON.') }
  if (!Array.isArray(input)) throw new Error('Environment variables must be a list.')
  const result: Array<{ key: string; value: string }> = []
  const names = new Set<string>()
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Each environment variable must have a name and value.')
    const row = item as Record<string, unknown>
    const key = typeof row.key === 'string' ? row.key.trim().toUpperCase() : ''
    const value = typeof row.value === 'string' ? row.value : ''
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) throw new Error(`Invalid environment variable name: ${key || '(empty)'}.`)
    if (names.has(key)) throw new Error(`Duplicate environment variable name: ${key}.`)
    names.add(key); result.push({ key, value })
  }
  return result
}
