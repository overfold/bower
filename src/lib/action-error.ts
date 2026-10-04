// Thrown on the server for failures the user can act on. Server actions catch it
// and return its message as `{ error }`: React redacts thrown errors in
// production, so a message that should reach the user can't travel as a throw.
export class ActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActionError'
  }
}

export function actionErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || 'digest' in error) return fallback
  return error.message || fallback
}
