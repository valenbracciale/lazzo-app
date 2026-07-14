"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Link2 } from "lucide-react";
import { PublicBookingSettings } from "@/components/dashboard/public-booking-settings";

export function PublicBookingLinkButton({
  businessId,
  businessName,
  origin,
  initialSlug,
  initialEnabled,
  initialMinAdvanceMinutes,
  initialMaxAdvanceDays,
  initialLogoUrl,
}: {
  businessId: string;
  businessName: string;
  origin: string;
  initialSlug: string;
  initialEnabled: boolean;
  initialMinAdvanceMinutes: number;
  initialMaxAdvanceDays: number;
  initialLogoUrl: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Link2 />
        Link de reserva
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {/* Card already provides its own title/description - this one is
              visually hidden, only to satisfy Dialog's accessible-name requirement. */}
          <DialogTitle className="sr-only">Link de reserva pública</DialogTitle>
          <PublicBookingSettings
            businessId={businessId}
            businessName={businessName}
            origin={origin}
            initialSlug={initialSlug}
            initialEnabled={initialEnabled}
            initialMinAdvanceMinutes={initialMinAdvanceMinutes}
            initialMaxAdvanceDays={initialMaxAdvanceDays}
            initialLogoUrl={initialLogoUrl}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
