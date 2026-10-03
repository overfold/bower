import type { BowerSecretBinding } from '@/lib/job-builder'

export type VariableService = {
  id: string
  name: string
  envVars: Record<string, string>
  secretBindings: BowerSecretBinding[]
}

export type VariableMatrixRow = {
  key: string
  shared: 'write-only' | 'empty'
  services: Array<
    | { kind: 'value'; value: string }
    | { kind: 'inherited' }
    | { kind: 'secret'; secretName: string; displayName: string; target: string }
    | { kind: 'empty' }
  >
}

export function buildVariableMatrix(
  sharedNames: string[],
  services: VariableService[],
  secretLabels: Record<string, string>,
): VariableMatrixRow[] {
  const keys = new Set(sharedNames)
  for (const service of services) {
    Object.keys(service.envVars).forEach((key) => keys.add(key))
    service.secretBindings.forEach((binding) => {
      if (binding.target === 'env' && binding.env) keys.add(binding.env)
      else if (binding.target === 'file' && binding.path) keys.add(binding.path)
    })
  }

  return [...keys].sort().map((key) => ({
    key,
    shared: sharedNames.includes(key) ? 'write-only' : 'empty',
    services: services.map((service) => {
      const binding = service.secretBindings.find((item) =>
        item.target === 'env' ? item.env === key : item.path === key,
      )
      if (binding) return {
        kind: 'secret' as const,
        secretName: binding.name,
        displayName: secretLabels[binding.name] ?? binding.name,
        target: binding.target,
      }
      if (key in service.envVars) return { kind: 'value' as const, value: service.envVars[key] }
      if (sharedNames.includes(key)) return { kind: 'inherited' as const }
      return { kind: 'empty' as const }
    }),
  }))
}

export function removeServiceVariable(service: VariableService, destination: string): VariableService {
  const envVars = { ...service.envVars }
  delete envVars[destination]
  return {
    ...service,
    envVars,
    secretBindings: service.secretBindings.filter((binding) =>
      binding.target === 'env' ? binding.env !== destination : binding.path !== destination,
    ),
  }
}

export function setServiceValue(service: VariableService, destination: string, value: string, previousDestination = destination): VariableService {
  const cleaned = removeServiceVariable(service, previousDestination)
  return { ...cleaned, envVars: { ...cleaned.envVars, [destination]: value } }
}

export function setServiceBinding(
  service: VariableService,
  binding: BowerSecretBinding,
  previousDestination: string,
): VariableService {
  const cleaned = removeServiceVariable(service, previousDestination)
  const destination = binding.target === 'env' ? binding.env : binding.path
  const withoutDestination = destination ? removeServiceVariable(cleaned, destination) : cleaned
  return { ...withoutDestination, secretBindings: [...withoutDestination.secretBindings, binding] }
}
