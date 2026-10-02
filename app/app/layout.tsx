import { DashboardShell } from "@/components/account/dashboard-shell";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
