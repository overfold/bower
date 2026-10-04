export type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info'

export const toneClasses: Record<Tone, string> = {
  neutral: 'border-line bg-sunken text-ink-soft',
  brand: 'border-brand-100 bg-brand-50 text-brand-700',
  success: 'border-ok-200 bg-ok-50 text-ok-500',
  warn: 'border-warn-200 bg-warn-50 text-warn-500',
  danger: 'border-danger-200 bg-danger-50 text-danger-500',
  info: 'border-info-200 bg-info-50 text-info-500',
}

// Icon color only, for notices on a neutral surface (toasts). The icon shape
// carries the tone too, so it is never conveyed by color alone.
export const toneIconClasses: Record<Tone, string> = {
  neutral: 'text-ink-muted',
  brand: 'text-brand-500',
  success: 'text-ok-500',
  warn: 'text-warn-500',
  danger: 'text-danger-500',
  info: 'text-info-500',
}
