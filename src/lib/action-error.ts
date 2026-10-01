export function actionErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || 'digest' in error) return fallback
  return error.message || fallback
}
