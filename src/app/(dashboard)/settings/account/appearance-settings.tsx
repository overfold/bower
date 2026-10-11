'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Theme = 'system' | 'light' | 'dark'

export function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => {
    const stored = (localStorage.getItem('theme') as Theme | null) ?? 'system'
    queueMicrotask(() => setTheme(stored))
  }, [])
  function update(next: string) {
    const value = next as Theme
    setTheme(value)
    localStorage.setItem('theme', value)
    const dark = value === 'dark' || (value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }
  return <Card><CardHeader title="Appearance" hint="How Bower looks on this device." /><CardContent className="space-y-2"><Label htmlFor="theme">Theme</Label><Select value={theme} onValueChange={update}><SelectTrigger id="theme" className="max-w-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system">System</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent></Select></CardContent></Card>
}
