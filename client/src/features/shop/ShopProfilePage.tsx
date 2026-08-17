import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";

const PHONE_PATTERN = /^\+?[0-9()\-.\s]{7,20}$/;

const shopProfileFormSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    description: z.string().trim().max(2000),
    address: z.string().trim().max(200),
    phone: z.string().trim(),
    logoUrl: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.phone && !PHONE_PATTERN.test(data.phone)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Invalid phone number" });
    }
    if (data.logoUrl) {
      try {
        new URL(data.logoUrl);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["logoUrl"],
          message: "logoUrl must be a valid URL",
        });
      }
    }
  });

type ShopProfileFormValues = z.infer<typeof shopProfileFormSchema>;

function toFormValues(shop: {
  name: string;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
}): ShopProfileFormValues {
  return {
    name: shop.name,
    description: shop.description ?? "",
    address: shop.address ?? "",
    phone: shop.phone ?? "",
    logoUrl: shop.logoUrl ?? "",
  };
}

export function ShopProfilePage() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const shopQuery = useQuery({
    queryKey: ["shop", "me"],
    queryFn: async () => (await api.getMyShop(session.token!)).shop,
    enabled: Boolean(session.token && session.user?.role === "ADMIN"),
  });

  const shopForm = useForm<ShopProfileFormValues>({
    resolver: zodResolver(shopProfileFormSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      phone: "",
      logoUrl: "",
    },
  });

  useEffect(() => {
    if (shopQuery.data) {
      shopForm.reset(toFormValues(shopQuery.data));
    }
  }, [shopQuery.data, shopForm]);

  const shopMutation = useMutation({
    mutationFn: async (values: ShopProfileFormValues) =>
      api.updateMyShop(session.token!, {
        name: values.name,
        description: values.description || null,
        address: values.address || null,
        phone: values.phone || null,
        logoUrl: values.logoUrl || null,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["shop", "me"], result.shop);
      shopForm.reset(toFormValues(result.shop));
    },
  });

  function onSubmit(values: ShopProfileFormValues) {
    shopMutation.mutate(values);
  }

  if (!session.user || session.user.role !== "ADMIN") {
    return null;
  }

  if (!shopQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shop profile</CardTitle>
          <CardDescription>Loading your shop profile…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Shop"
        title="Shop profile"
        description="Update the public information customers see for your rental business."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Public details</CardTitle>
            <CardDescription>These fields help customers recognize and contact your shop.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={shopForm.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="field-stack">
                <Label htmlFor="shop-name">Shop name</Label>
                <Input id="shop-name" {...shopForm.register("name")} />
                {shopForm.formState.errors.name ? (
                  <p className="text-sm text-destructive">{shopForm.formState.errors.name.message}</p>
                ) : null}
              </div>

              <div className="field-stack">
                <Label htmlFor="shop-description">Description</Label>
                <Textarea id="shop-description" {...shopForm.register("description")} />
                {shopForm.formState.errors.description ? (
                  <p className="text-sm text-destructive">{shopForm.formState.errors.description.message}</p>
                ) : null}
              </div>

              <div className="field-stack">
                <Label htmlFor="shop-address">Address</Label>
                <Input id="shop-address" {...shopForm.register("address")} />
                {shopForm.formState.errors.address ? (
                  <p className="text-sm text-destructive">{shopForm.formState.errors.address.message}</p>
                ) : null}
              </div>

              <div className="field-stack">
                <Label htmlFor="shop-phone">Phone</Label>
                <Input id="shop-phone" {...shopForm.register("phone")} />
                {shopForm.formState.errors.phone ? (
                  <p className="text-sm text-destructive">{shopForm.formState.errors.phone.message}</p>
                ) : null}
              </div>

              <div className="field-stack">
                <Label htmlFor="shop-logo-url">Logo URL</Label>
                <Input id="shop-logo-url" {...shopForm.register("logoUrl")} />
                {shopForm.formState.errors.logoUrl ? (
                  <p className="text-sm text-destructive">{shopForm.formState.errors.logoUrl.message}</p>
                ) : null}
              </div>

              <Button type="submit" disabled={shopMutation.isPending}>
                Save shop profile
              </Button>

              {shopMutation.error ? (
                <Alert variant="destructive">{getApiMessage(shopMutation.error)}</Alert>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shop summary</CardTitle>
            <CardDescription>Quick reference details for the storefront linked to this admin account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="surface-muted space-y-4 rounded-2xl p-5">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                <StatusBadge status={shopQuery.data.status} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Owner</p>
                <p className="text-sm font-medium text-foreground">{session.user.name}</p>
              </div>
              {shopQuery.data.address ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Address</p>
                  <p className="text-wrap-safe text-sm text-slate-700">{shopQuery.data.address}</p>
                </div>
              ) : null}
              {shopQuery.data.phone ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Phone</p>
                  <p className="text-sm text-slate-700">{shopQuery.data.phone}</p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
