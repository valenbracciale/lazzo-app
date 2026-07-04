import { getCurrentBusiness } from "@/lib/business";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import { UnlockTheme } from "@/components/dashboard/unlock-theme";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const business = await getCurrentBusiness();

  return (
    <SidebarProvider>
      <UnlockTheme />
      <DashboardSidebar />
      <SidebarInset>
        <DashboardHeader businessName={business.name} email={business.ownerEmail} />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
