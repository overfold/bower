export type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info'

export const toneClasses: Record<Tone, string> = {
  neutral: 'border-line bg-sunken text-ink-soft',
  brand: 'border-brand-100 bg-brand-50 text-brand-700',
  success: 'border-ok-200 bg-ok-50 text-ok-500',
  warn: 'border-warn-200 bg-warn-50 text-warn-500',
  danger: 'border-danger-200 bg-danger-50 text-danger-500',
  info: 'border-info-200 bg-info-50 text-info-500',
}
