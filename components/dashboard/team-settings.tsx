"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { inviteMember } from "@/app/dashboard/settings/actions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export type BusinessMember = {
  id: string;
  name: string;
  email: string;
  status: "invited" | "active" | "revoked";
  professional_id: string | null;
};

const NO_PROFESSIONAL = "__none__";

const STATUS_LABEL: Record<BusinessMember["status"], string> = {
  invited: "Invitado",
  active: "Activo",
  revoked: "Revocado",
};

const STATUS_VARIANT: Record<
  BusinessMember["status"],
  "default" | "outline" | "destructive"
> = {
  invited: "outline",
  active: "default",
  revoked: "destructive",
};

export function TeamSettings({
  members,
  professionals = [],
  professionalLabel = "profesional",
  sectionLabel = "Reservas",
}: {
  members: BusinessMember[];
  professionals?: { id: string; name: string }[];
  professionalLabel?: string;
  sectionLabel?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [professionalId, setProfessionalId] = useState(NO_PROFESSIONAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const linkedProfessionalIds = new Set(
    members.map((m) => m.professional_id).filter((id): id is string => !!id)
  );
  const availableProfessionals = professionals.filter((p) => !linkedProfessionalIds.has(p.id));

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSent(false);

    const result = await inviteMember({
      name,
      email,
      professionalId: professionalId === NO_PROFESSIONAL ? null : professionalId,
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    setSent(true);
    setName("");
    setEmail("");
    setProfessionalId(NO_PROFESSIONAL);
    router.refresh();
  }

  async function handleRevoke(memberId: string) {
    setRevokingId(memberId);
    setError(null);

    const supabase = createClient();
    const { data, error: revokeError } = await supabase
      .from("business_members")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", memberId)
      .select("id");

    setRevokingId(null);

    // RLS lets an UPDATE with no matching row succeed with zero rows affected
    // instead of erroring - checking only `error` would still miss that and
    // leave the owner believing access was revoked when it wasn't.
    if (revokeError || !data || data.length === 0) {
      setError("No pudimos revocar el acceso. Probá de nuevo.");
      return;
    }

    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipo</CardTitle>
        <CardDescription>
          Invitá encargados para que trabajen en {sectionLabel} junto a vos.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleInvite}>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="member-name">Nombre</Label>
            <Input
              id="member-name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSent(false);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSent(false);
              }}
            />
          </div>
          {availableProfessionals.length > 0 && (
            <div className="space-y-1.5">
              <Label>Vincular a {professionalLabel}</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROFESSIONAL}>Sin vincular</SelectItem>
                  {availableProfessionals.map((professional) => (
                    <SelectItem key={professional.id} value={professional.id}>
                      {professional.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {loading ? "Invitando..." : "Invitar encargado"}
          </Button>
        </CardContent>
      </form>

      {(error || sent) && (
        <CardContent className="pt-0">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {sent && (
            <p className="text-sm text-muted-foreground">
              Invitación enviada.
            </p>
          )}
        </CardContent>
      )}

      {members.length > 0 && (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[member.status]}>
                      {STATUS_LABEL[member.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {member.status !== "revoked" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={revokingId === member.id}
                        onClick={() => handleRevoke(member.id)}
                      >
                        {revokingId === member.id && (
                          <Loader2 className="animate-spin" />
                        )}
                        Revocar acceso
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
