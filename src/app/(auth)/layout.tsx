import { AuthLayout as SharedAuthLayout } from '@/components/auth-layout'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <SharedAuthLayout>{children}</SharedAuthLayout>
}
