'use client'

import { useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTerm } from '@xterm/xterm'
import { Terminal } from 'lucide-react'
import {
  closeExecSessionAction,
  readExecSessionAction,
  resizeExecSessionAction,
  startExecSessionAction,
  writeExecSessionAction,
} from '@/lib/actions/services'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type TerminalStatus = 'idle' | 'connecting' | 'connected' | 'exited' | 'error'

function stringToBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function ExecDialog({ allocationId, serviceConfigId }: { allocationId: string; serviceConfigId: string }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<TerminalStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const terminalElementRef = useRef<HTMLDivElement | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const writeChainRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!open || !terminalElementRef.current) return

    let active = true
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    let lastSize = { cols: 0, rows: 0 }
    const element = terminalElementRef.current
    const fitAddon = new FitAddon()
    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 5000,
      allowProposedApi: false,
      theme: {
        background: '#0b1113',
        foreground: '#d6e0df',
        cursor: '#61b9aa',
        cursorAccent: '#0b1113',
        selectionBackground: '#21413d',
        black: '#0b1113',
        brightBlack: '#5b6d6d',
        red: '#e47b74',
        brightRed: '#f08c84',
        green: '#66bfae',
        brightGreen: '#7bd0bf',
        yellow: '#d7b46a',
        brightYellow: '#e4c47b',
        blue: '#79a9d1',
        brightBlue: '#8ab9df',
        magenta: '#b99ad9',
        brightMagenta: '#c8a8e7',
        cyan: '#69b9c2',
        brightCyan: '#7ccbd3',
        white: '#d6e0df',
        brightWhite: '#f2f6f5',
      },
    })
    terminal.loadAddon(fitAddon)
    terminal.open(element)

    const fit = () => {
      try {
        fitAddon.fit()
      } catch {
        // The dialog can be between layout states while opening/closing.
      }
    }

    fit()
    terminal.focus()
    setStatus('connecting')
    setError(null)

    const dataDisposable = terminal.onData((data) => {
      const sessionId = sessionIdRef.current
      if (!sessionId || !active) return
      const encoded = stringToBase64(data)
      writeChainRef.current = writeChainRef.current
        .then(() => writeExecSessionAction(serviceConfigId, allocationId, sessionId, encoded))
        .catch((reason: unknown) => {
          if (!active) return
          setStatus('error')
          setError(reason instanceof Error ? reason.message : 'Failed to send terminal input.')
        })
    })

    const resizeObserver = new ResizeObserver(() => {
      if (!active) return
      fit()
      const sessionId = sessionIdRef.current
      if (!sessionId || terminal.cols < 1 || terminal.rows < 1) return
      if (terminal.cols === lastSize.cols && terminal.rows === lastSize.rows) return
      lastSize = { cols: terminal.cols, rows: terminal.rows }
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (!active || !sessionIdRef.current) return
        void resizeExecSessionAction(
          serviceConfigId,
          allocationId,
          sessionIdRef.current,
          lastSize.cols,
          lastSize.rows,
        ).catch(() => undefined)
      }, 120)
    })
    resizeObserver.observe(element)

    async function start() {
      try {
        fit()
        const session = await startExecSessionAction(
          serviceConfigId,
          allocationId,
          Math.max(terminal.cols, 1),
          Math.max(terminal.rows, 1),
        )
        if (!active) {
          await closeExecSessionAction(serviceConfigId, allocationId, session.id).catch(() => undefined)
          return
        }

        sessionIdRef.current = session.id
        lastSize = { cols: terminal.cols, rows: terminal.rows }
        setStatus('connected')
        terminal.focus()

        let offset = 0
        while (active && sessionIdRef.current === session.id) {
          const output = await readExecSessionAction(serviceConfigId, allocationId, session.id, offset)
          if (!active || sessionIdRef.current !== session.id) break

          if (output.data_base64) terminal.write(base64ToBytes(output.data_base64))
          offset = output.next_offset

          if (output.exited) {
            const code = output.exit_code
            terminal.write(`\r\n\x1b[90m[process exited${code === undefined ? '' : ` with code ${code}`}]\x1b[0m\r\n`)
            setStatus('exited')
            sessionIdRef.current = null
            await closeExecSessionAction(serviceConfigId, allocationId, session.id).catch(() => undefined)
            break
          }

          await wait(output.data_base64 ? 30 : 120)
        }
      } catch (reason) {
        if (!active) return
        setStatus('error')
        setError(reason instanceof Error ? reason.message : 'Unable to open an interactive terminal.')
      }
    }

    void start()

    return () => {
      active = false
      dataDisposable.dispose()
      resizeObserver.disconnect()
      if (resizeTimer) clearTimeout(resizeTimer)
      const sessionId = sessionIdRef.current
      sessionIdRef.current = null
      if (sessionId) {
        void closeExecSessionAction(serviceConfigId, allocationId, sessionId).catch(() => undefined)
      }
      terminal.dispose()
      writeChainRef.current = Promise.resolve()
    }
  }, [allocationId, open, serviceConfigId])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setStatus('idle')
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Terminal className="mr-1.5 h-3.5 w-3.5" />
          Terminal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Interactive terminal</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div
            className="overflow-hidden rounded-md border border-line-strong bg-[#0b1113] p-2"
            onMouseDown={() => terminalElementRef.current?.focus()}
          >
            <div
              ref={terminalElementRef}
              className="h-[420px] min-h-[280px] w-full"
              aria-label="Interactive allocation terminal"
            />
          </div>
          <div className="flex min-h-5 items-center justify-between gap-4 text-2xs text-ink-muted">
            <span className="font-mono">{allocationId.slice(0, 8)}</span>
            <span>
              {status === 'connecting' && 'Connecting…'}
              {status === 'connected' && 'Connected'}
              {status === 'exited' && 'Shell exited'}
              {status === 'error' && (error || 'Terminal connection failed')}
            </span>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
