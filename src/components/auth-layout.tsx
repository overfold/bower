import { Brand } from '@/components/brand'
import { GrowingTrellis } from '@/components/growing-trellis'

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-brand-950 px-4 py-6 sm:px-6 sm:py-8">
    <GrowingTrellis className="absolute inset-0 h-full w-full" />
    <div className="relative z-10 sm:absolute sm:left-8 sm:top-8"><Brand size="default" className="text-white [&>span:last-child]:text-white" /></div>
    <section className="relative z-10 flex flex-1 items-center justify-center py-12 sm:py-20">
      <div className="absolute h-[calc(100%+5rem)] w-full max-w-[560px] bg-brand-950/75 blur-2xl" aria-hidden="true" />
      <div className="relative w-full max-w-[420px] rounded-xl border border-line bg-surface p-5 shadow-pop sm:p-6">{children}</div>
    </section>
    <div className="relative z-10 mx-auto text-center text-white">
      <p className="text-sm font-semibold">Manage deployments on Trellis.</p>
      <p className="mt-1 text-xs text-white/70">Projects, services, deployments, and access — together in one place.</p>
    </div>
  </main>
}
