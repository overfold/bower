'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * Tabs whose selection lives in the URL (?tab=lifecycle) so a link can open a specific tab. The server
 * passes the initial tab; changing tabs updates the address bar without a navigation or a server render.
 */
export function UrlTabs({ tabs, initial, label, param = 'tab', children }: { tabs: { value: string; label: string }[]; initial: string; label: string; param?: string; children: React.ReactNode }) {
  const [value, setValue] = useState(tabs.some((tab) => tab.value === initial) ? initial : tabs[0].value)
  function select(next: string) {
    setValue(next)
    const url = new URL(window.location.href)
    url.searchParams.set(param, next)
    window.history.replaceState(window.history.state, '', url)
  }
  return <Tabs value={value} onValueChange={select}>
    <TabsList aria-label={label} className="w-full justify-start gap-1 rounded-none border-0 bg-transparent p-0">
      {tabs.map((tab) => <TabsTrigger key={tab.value} value={tab.value} className="rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-brand-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none">{tab.label}</TabsTrigger>)}
    </TabsList>
    {children}
  </Tabs>
}
