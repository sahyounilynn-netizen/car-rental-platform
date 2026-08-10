import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getApiMessage } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfilePage() {
  const { session, updateUser } = useSession();
  const [profileDraft, setProfileDraft] = useState({
    name: session.user?.name ?? "",
    phone: session.user?.phone ?? "",
  });

  const profileMutation = useMutation({
    mutationFn: async () =>
      api.updateProfile(session.token!, {
        name: profileDraft.name,
        phone: profileDraft.phone || undefined,
      }),
    onSuccess: (result) => {
      updateUser(result.user);
    },
  });

  if (!session.user) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update the information stored on your account.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={profileDraft.name}
              onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input
              id="profile-phone"
              value={profileDraft.phone}
              onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })}
            />
          </div>
          <Button onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
            Save profile
          </Button>
          {profileMutation.error && (
            <p className="text-sm text-destructive">{getApiMessage(profileMutation.error)}</p>
          )}
        </div>
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-medium">Account summary</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Email: {session.user.email}</p>
            <p>Role: {session.user.role}</p>
            {session.user.shop && <p>Shop: {session.user.shop.name}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
