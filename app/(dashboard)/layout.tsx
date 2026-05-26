import NavShell from '@/components/nav/NavShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <NavShell>{children}</NavShell>
}
