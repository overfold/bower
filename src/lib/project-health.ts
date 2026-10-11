/** Project health uses current service observations, never deployment history. */
export function projectHealth(services: readonly { health: string }[]) {
  const total = services.length
  const failing = services.filter(({ health }) => health !== 'healthy').length
  return {
    label: total === 0 ? 'No services' : failing ? `${failing} of ${total} failing` : 'Healthy',
    tone: total === 0 ? 'neutral' as const : failing ? 'danger' as const : 'success' as const,
  }
}
