import type { BowerSecretBinding } from './job-builder'

export function parseEnvText(text: string): Array<{ key: string; value: string }> {
  return text.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith('#')).map((line) => {
    const normalized = line.trimStart().startsWith('export ') ? line.trimStart().slice(7) : line
    const separator = normalized.indexOf('=')
    return separator < 0
      ? { key: normalized.trim().toUpperCase(), value: '' }
      : { key: normalized.slice(0, separator).trim().toUpperCase(), value: normalized.slice(separator + 1) }
  })
}

export function parseEnvironmentVariableRows(value: FormDataEntryValue | null) {
  let input: unknown
  try { input = JSON.parse(String(value ?? '[]')) } catch { throw new Error('Environment variables must be valid JSON.') }
  if (!Array.isArray(input)) throw new Error('Environment variables must be a list.')
  const result: Array<{ key: string; value: string }> = []
  const names = new Set<string>()
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Each environment variable must have a name and value.')
    const row = item as Record<string, unknown>
    if (typeof row.key !== 'string' || typeof row.value !== 'string') throw new Error('Each environment variable must have a name and value.')
    const key = row.key.trim().toUpperCase()
    const value = row.value
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) throw new Error(`Invalid environment variable name: ${key || '(empty)'}.`)
    if (names.has(key)) throw new Error(`Duplicate environment variable name: ${key}.`)
    names.add(key); result.push({ key, value })
  }
  return result
}

export function environmentVariableRecord(value: FormDataEntryValue | null) {
  return Object.fromEntries(parseEnvironmentVariableRows(value).map(({ key, value: rowValue }) => [key, rowValue]))
}

export function validateServiceVariableConflicts(
  envVars: Record<string, string>,
  secretBindings: BowerSecretBinding[],
  environmentEnv: Record<string, string>,
  availableSecrets: Set<string>,
  environmentName: string,
) {
  const environmentNames = new Set(Object.keys(environmentEnv))
  const plainConflict = Object.keys(envVars).find((name) => environmentNames.has(name))
  if (plainConflict) throw new Error(`${plainConflict} is already defined by the environment.`)

  const secretTargetConflict = secretBindings.find((binding) =>
    binding.target === 'env' && binding.env && (binding.env in envVars || environmentNames.has(binding.env)))
  if (secretTargetConflict) {
    const source = secretTargetConflict.env && environmentNames.has(secretTargetConflict.env)
      ? 'the environment'
      : 'a service variable'
    throw new Error(`Secret target ${secretTargetConflict.env} conflicts with ${source}.`)
  }

  const environmentSecretNames = new Set(Object.values(environmentEnv))
  const duplicateEnvironmentSecret = secretBindings.find((binding) => environmentSecretNames.has(binding.name))
  if (duplicateEnvironmentSecret) throw new Error(`Secret ${duplicateEnvironmentSecret.name} is already injected by the environment.`)
  const missing = secretBindings.find((binding) => !availableSecrets.has(binding.name))
  if (missing) throw new Error(`Secret ${missing.name} does not exist in ${environmentName}.`)
}
