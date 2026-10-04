export class RequestBodyError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export const BODY_LIMITS = { webhook: 64 * 1024, deploy: 8 * 1024, password: 8 * 1024 } as const

export async function readRequestBody(request: Request, limit: number, timeoutMs = 5_000): Promise<Buffer> {
  const declared = request.headers.get('content-length')
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    void request.body?.cancel().catch(() => {})
    throw new RequestBodyError('Request body too large or invalid Content-Length.', 413)
  }
  if (!request.body) return Buffer.alloc(0)
  const reader = request.body.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestBodyError('Request body timed out.', 408)), timeoutMs)
  })
  const chunks: Buffer[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline])
      if (done) break
      size += value.byteLength
      if (size > limit) throw new RequestBodyError('Request body too large.', 413)
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, size)
  } catch (error) {
    void reader.cancel().catch(() => {})
    if (error instanceof RequestBodyError) throw error
    throw new RequestBodyError('Invalid request body.', 400)
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
  }
}

export function requestBodyErrorResponse(error: unknown): Response {
  return Response.json({ error: error instanceof RequestBodyError ? error.message : 'Invalid request body.' }, { status: error instanceof RequestBodyError ? error.status : 400 })
}
