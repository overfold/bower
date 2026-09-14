import { Brand } from '@/components/brand'
import { GrowingTrellis } from '@/components/growing-trellis'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#0b1915] lg:grid lg:min-h-screen lg:grid-cols-[57fr_43fr] lg:overflow-visible lg:bg-canvas">
      {/* Left — dark panel with vine trellis */}
      <section
        className="absolute inset-0 flex min-h-[100dvh] flex-col justify-between overflow-hidden px-6 py-6 sm:px-10 sm:py-8 lg:relative lg:inset-auto lg:h-auto lg:min-h-screen lg:px-12 lg:py-10"
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
        <p className="relative hidden text-xs text-ink-muted lg:block">
          bower &middot; deployment platform for Trellis
        </p>
      </section>

      {/* Right — auth form */}
      <section className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-24 sm:px-10 lg:min-h-screen lg:bg-canvas lg:px-12 lg:py-10 xl:px-16">
        <div className="w-full max-w-[368px]">
          <div className="rounded-2xl border border-line bg-surface/95 p-5 shadow-pop backdrop-blur-sm sm:p-6 lg:bg-surface lg:shadow-raised">
            {children}
          </div>
        </div>
      </section>
    </div>
  )
}
