export const API_KEY_SCOPES = ['read', 'deploy', 'restart', 'rollback'] as const
export type ApiKeyScope = typeof API_KEY_SCOPES[number]
