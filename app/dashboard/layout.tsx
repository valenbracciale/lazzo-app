import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingState } from "@/lib/onboarding.server";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import { UnlockTheme } from "@/components/dashboard/unlock-theme";
import { OnboardingFlow } from "@/components/dashboard/onboarding-flow";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const business = await getCurrentBusiness();
  const supabase = await createClient();
  const onboarding = await getOnboardingState(supabase, business.id);

  return (
    <SidebarProvider>
      <UnlockTheme />
      <DashboardSidebar role={business.role} />
      <SidebarInset>
        <DashboardHeader businessName={business.name} email={business.email} />
        <OnboardingFlow
          businessId={business.id}
          businessType={business.businessType}
          businessTypeSetup={onboarding.businessTypeSetup}
          reservationsSetup={onboarding.reservationsSetup}
          isOwner={business.role === "owner"}
        >
          <main className="flex-1 p-6">{children}</main>
        </OnboardingFlow>
      </SidebarInset>
    </SidebarProvider>
  );
}
