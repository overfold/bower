type DeploymentSummary = {
  id: string
  status: string
  createdAt: Date | string
}

export function deploymentDetailState<T extends DeploymentSummary>(journal: T[], deploymentId: string) {
  const current = journal.find((deployment) => deployment.id === deploymentId)
  const superseding = current
    ? journal
        .filter((deployment) => deployment.id !== deploymentId && new Date(deployment.createdAt).getTime() > new Date(current.createdAt).getTime())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : undefined

  return {
    superseding,
    primaryRecovery: current?.status === 'failed' && !superseding,
  }
}
