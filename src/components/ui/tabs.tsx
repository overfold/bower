import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('inline-flex items-center gap-0.5 rounded-lg border border-line bg-sunken p-0.5 text-ink-muted', className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ease-enter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:text-ink-muted data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-card data-[state=inactive]:text-ink-muted data-[state=inactive]:hover:text-ink",
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface', className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

/** Underline tabs for page sections (a variant of the pill tabs above): pass to TabsList and TabsTrigger. */
const underlineTabsListClass = 'w-full justify-start gap-1 rounded-none border-0 bg-transparent p-0'
const underlineTabsTriggerClass = 'rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-brand-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none'

export { Tabs, TabsList, TabsTrigger, TabsContent, underlineTabsListClass, underlineTabsTriggerClass }
