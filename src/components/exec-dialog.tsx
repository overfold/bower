'use client'

import { useEffect, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTerm } from '@xterm/xterm'
import { Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type TerminalStatus = 'idle' | 'connecting' | 'connected' | 'exited' | 'error'

function frame(type: number, payload: Uint8Array = new Uint8Array()) {
  const result = new Uint8Array(1 + payload.length)
  result[0] = type
  result.set(payload, 1)
  return result
}

export function ExecDialog({
  allocationId,
  serviceConfigId,
  tasks,
}: {
  allocationId: string
  serviceConfigId: string
  tasks: string[]
}) {
  const [open, setOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(tasks[0] ?? '')
  const [status, setStatus] = useState<TerminalStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [terminalElement, setTerminalElement] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    // The animated portal mounts after open changes. Start on actual mount,
    // not the render that merely requests an open dialog.
    if (!open || !terminalElement) return

    let active = true
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    let lastSize = { cols: 0, rows: 0 }
    const element = terminalElement
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

    const url = new URL('/api/exec/stream', window.location.href)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.search = new URLSearchParams({ serviceConfigId, allocationId, task: selectedTask,
      cols: String(Math.min(Math.max(terminal.cols, 1), 1000)), rows: String(Math.min(Math.max(terminal.rows, 1), 1000)) }).toString()
    const socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'
    let finished = false
    const fail = (message: string) => {
      if (!active || finished) return
      finished = true
      setStatus('error')
      setError(message)
      socket.close()
    }
    const send = (type: number, payload: Uint8Array = new Uint8Array()) => {
      if (!active || finished || socket.readyState !== WebSocket.OPEN) return
      // Browser WebSockets cannot await drain. Bound queued input rather than
      // retaining an arbitrarily large paste while Trellis is blocked.
      if (socket.bufferedAmount + payload.length + 1 > 128 * 1024) {
        fail('Terminal input buffer exceeded; reconnect and send smaller input.')
        return
      }
      socket.send(frame(type, payload))
    }
    const encoder = new TextEncoder()
    const writeInput = (bytes: Uint8Array) => {
      for (let offset = 0; offset < bytes.length; offset += 32768) send(1, bytes.subarray(offset, offset + 32768))
    }
    const dataDisposable = terminal.onData((data) => writeInput(encoder.encode(data)))
    const binaryDisposable = terminal.onBinary((data) => writeInput(Uint8Array.from(data, (char) => char.charCodeAt(0))))
    socket.onopen = () => {
      if (!active) { socket.close(); return }
      setStatus('connected')
      terminal.focus()
      fit()
      send(3, encoder.encode(JSON.stringify({ cols: Math.min(terminal.cols, 1000), rows: Math.min(terminal.rows, 1000) })))
    }
    socket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (!active || finished) return
      try {
        const bytes = new Uint8Array(event.data)
        if (bytes.length < 1 || bytes.length > 32769) throw new Error('Malformed terminal frame')
        const type = bytes[0]
        const payload = bytes.subarray(1)
        if (type === 4 || type === 5) {
          // xterm preserves raw bytes and split UTF-8 sequences. Acknowledging
          // only after rendering bounds output all the way back to Trellis.
          terminal.write(payload, () => send(8))
        } else {
          const result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload))
          if (type === 6 && Number.isInteger(result.exit_code)) {
            finished = true
            terminal.write(`\r\n\x1b[90m[process exited with code ${result.exit_code}]\x1b[0m\r\n`)
            setStatus('exited')
            socket.close()
          } else if ((type === 7 || type === 10) && typeof result.message === 'string') {
            fail(`${type === 7 ? 'Exec error' : 'Connection error'}: ${result.message}`)
          } else throw new Error('Unexpected terminal frame')
        }
      } catch (reason) { fail(reason instanceof Error ? reason.message : 'Terminal stream failed') }
    }
    socket.onerror = () => fail('Unable to open terminal. Check permissions and Trellis connectivity.')
    socket.onclose = () => fail('Terminal disconnected without an exit status.')
    const disconnect = () => socket.close()
    window.addEventListener('pagehide', disconnect)

    const resizeObserver = new ResizeObserver(() => {
      if (!active) return
      fit()
      if (terminal.cols < 1 || terminal.rows < 1) return
      const cols = Math.min(terminal.cols, 1000)
      const rows = Math.min(terminal.rows, 1000)
      if (cols === lastSize.cols && rows === lastSize.rows) return
      lastSize = { cols, rows }
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => send(3, encoder.encode(JSON.stringify(lastSize))), 120)
    })
    resizeObserver.observe(element)

    return () => {
      active = false
      dataDisposable.dispose()
      binaryDisposable.dispose()
      resizeObserver.disconnect()
      if (resizeTimer) clearTimeout(resizeTimer)
      window.removeEventListener('pagehide', disconnect)
      socket.close()
      terminal.dispose()
    }
  }, [allocationId, open, selectedTask, serviceConfigId, terminalElement])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    setStatus(nextOpen ? 'connecting' : 'idle')
    setError(null)
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
          {tasks.length > 1 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-ink-soft">Task</span>
              <Select value={selectedTask} onValueChange={(task) => {
                setSelectedTask(task)
                setStatus('connecting')
                setError(null)
              }}>
                <SelectTrigger className="h-8 w-48 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((task) => (
                    <SelectItem key={task} value={task} className="font-mono text-xs">
                      {task}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div
            className="overflow-hidden rounded-md border border-line-strong bg-[#0b1113] p-2"
            onMouseDown={() => terminalElement?.querySelector('textarea')?.focus()}
          >
            <div
              ref={setTerminalElement}
              className="h-[420px] min-h-[280px] w-full"
              aria-label="Interactive allocation terminal"
            />
          </div>
          <div className="flex min-h-5 items-center justify-between gap-4 text-2xs text-ink-muted">
            <span className="font-mono">
              {allocationId.slice(0, 8)}{selectedTask ? ` · ${selectedTask}` : ''}
            </span>
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
