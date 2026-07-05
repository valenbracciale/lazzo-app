import { getCurrentBusiness } from "@/lib/business";
import { SettingsView } from "@/components/dashboard/settings-view";

export default async function SettingsPage() {
  const business = await getCurrentBusiness();

  return (
    <SettingsView businessId={business.id} businessName={business.name} />
  );
}
