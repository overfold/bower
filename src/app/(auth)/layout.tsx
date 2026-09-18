import { Brand } from '@/components/brand'
import { GrowingTrellis } from '@/components/growing-trellis'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] w-full bg-[#0b1915] lg:grid lg:min-h-screen lg:grid-cols-[57fr_43fr] lg:bg-canvas">
      {/* Left — dark panel with growing trellis */}
      <section
        className="absolute inset-0 flex min-h-[100dvh] flex-col overflow-hidden px-6 py-6 sm:px-10 sm:py-8 lg:relative lg:inset-auto lg:h-auto lg:min-h-screen lg:px-12 lg:py-10"
        style={
          {
            backgroundColor: '#0b1915',
            '--ink': 'hsl(167 33% 95%)',
            '--ink-muted': 'hsl(170 20% 60%)',
            '--brand-500': 'hsl(172 52% 36%)',
          } as React.CSSProperties
        }
      >
        <GrowingTrellis className="absolute inset-0 h-full w-full" />
        <div className="relative">
          <Brand size="default" />
        </div>
      </section>

      {/* Right — product context and auth form */}
      <section className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-20 sm:px-10 lg:min-h-screen lg:bg-canvas lg:px-12 lg:py-10 xl:px-16">
        <div className="w-full max-w-[420px] space-y-6 sm:space-y-7">
          <div className="space-y-2.5 px-1 text-center lg:text-left">
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl lg:text-ink">
              Manage deployments on Trellis.
            </h1>
            <p className="mx-auto max-w-[390px] text-[13px] leading-5 text-white/60 sm:text-[13.5px] lg:mx-0 lg:text-ink-muted">
              Bower is the deployment dashboard for Trellis, bringing projects, environments, services,
              deployments, domains, and access together in one place.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-raised sm:p-6">
            {children}
          </div>
        </div>
      </section>
    </div>
  )
}
