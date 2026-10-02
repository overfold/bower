import { Brand } from '@/components/brand'
import { GrowingTrellis } from '@/components/growing-trellis'

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="relative min-h-[100dvh] w-full bg-brand-950 lg:grid lg:grid-cols-[40fr_60fr] lg:bg-canvas">
    <section className="absolute inset-0 flex min-h-[100dvh] flex-col overflow-hidden px-6 py-6 lg:relative lg:min-h-screen lg:px-12 lg:py-10" style={{ backgroundColor: 'var(--color-brand-950)', '--ink': 'hsl(167 33% 95%)' } as React.CSSProperties}>
      <GrowingTrellis className="absolute inset-0 h-full w-full" /><div className="relative"><Brand size="default" /></div>
      <div className="relative mt-auto hidden pb-12 text-white lg:block"><h1 className="text-2xl font-semibold tracking-tight">Manage deployments on Trellis.</h1><p className="mt-3 max-w-sm text-sm text-white/75">Projects, services, deployments, and access — together in one place.</p></div>
    </section>
    <section className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-20 lg:min-h-screen lg:bg-canvas lg:px-12"><div className="w-full max-w-[420px] rounded-xl border border-line bg-surface p-5 shadow-raised sm:p-6">{children}</div></section>
  </div>
}
