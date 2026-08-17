import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { getApiMessage } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";

const PHONE_PATTERN = /^\+?[0-9()\-.\s]{7,20}$/;

const profileFormSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    phone: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.phone && !PHONE_PATTERN.test(data.phone)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Invalid phone number" });
    }
  });

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function ProfilePage() {
  const { session, updateUser } = useSession();

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: session.user?.name ?? "",
      phone: session.user?.phone ?? "",
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) =>
      api.updateProfile(session.token!, {
        name: values.name,
        phone: values.phone || undefined,
      }),
    onSuccess: (result) => {
      updateUser(result.user);
    },
  });

  function onSubmit(values: ProfileFormValues) {
    profileMutation.mutate(values);
  }

  if (!session.user) {
    return null;
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Account"
        title="Profile"
        description="Update the information stored on your account and review your current workspace role."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>Keep your account name and contact information current.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={profileForm.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="field-stack">
                <Label htmlFor="profile-name">Name</Label>
                <Input id="profile-name" {...profileForm.register("name")} />
                {profileForm.formState.errors.name ? (
                  <p className="text-sm text-destructive">{profileForm.formState.errors.name.message}</p>
                ) : null}
              </div>

              <div className="field-stack">
                <Label htmlFor="profile-phone">Phone</Label>
                <Input id="profile-phone" {...profileForm.register("phone")} />
                {profileForm.formState.errors.phone ? (
                  <p className="text-sm text-destructive">{profileForm.formState.errors.phone.message}</p>
                ) : null}
              </div>

              <Button type="submit" disabled={profileMutation.isPending}>
                Save profile
              </Button>

              {profileMutation.error ? (
                <Alert variant="destructive">{getApiMessage(profileMutation.error)}</Alert>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account summary</CardTitle>
            <CardDescription>Reference details tied to your current session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="surface-muted space-y-4 rounded-2xl p-5">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Email</p>
                <p className="text-wrap-safe text-sm font-medium text-foreground">{session.user.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Role</p>
                <StatusBadge status={session.user.role} />
              </div>
              {session.user.status ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                  <StatusBadge status={session.user.status} />
                </div>
              ) : null}
              {session.user.shop ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Shop</p>
                  <p className="text-wrap-safe text-sm font-medium text-foreground">{session.user.shop.name}</p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
