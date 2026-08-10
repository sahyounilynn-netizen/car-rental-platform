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

// The server's phoneSchema validates via libphonenumber-js, which isn't a
// client dependency — this is a lightweight client-side pre-check for early
// feedback, reusing the server's exact message. The server remains the
// source of truth (surfaced via Alert on submit if it disagrees).
const PHONE_PATTERN = /^\+?[0-9()\-.\s]{7,20}$/;

// Server's updateProfileSchema also refines that at least one field must be
// present in the request body ("At least one field must be provided"), to
// reject a truly empty PATCH. That's unreachable from this form: `name` is
// always required and always sent, so the payload can never be empty — no
// separate client-side rule is needed to mirror it. Confirmed by hitting
// PATCH /users/me with `{}` directly rather than assuming.
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
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update the information stored on your account.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[minmax(0,420px)_1fr]">
        <form onSubmit={profileForm.handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input id="profile-name" {...profileForm.register("name")} />
            {profileForm.formState.errors.name && (
              <p className="text-sm text-destructive">{profileForm.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input id="profile-phone" {...profileForm.register("phone")} />
            {profileForm.formState.errors.phone && (
              <p className="text-sm text-destructive">{profileForm.formState.errors.phone.message}</p>
            )}
          </div>
          <Button type="submit" disabled={profileMutation.isPending}>
            Save profile
          </Button>
          {profileMutation.error && (
            <Alert variant="destructive">{getApiMessage(profileMutation.error)}</Alert>
          )}
        </form>
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
