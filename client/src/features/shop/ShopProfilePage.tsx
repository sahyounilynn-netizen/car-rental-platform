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
import { Textarea } from "@/components/ui/textarea";

// Mirrors server/src/modules/shops/shops.validators.ts updateShopSchema
// (checked directly, not assumed): same field limits and, for phone/logoUrl,
// the same error messages. Phone reuses the same lightweight client-side
// pre-check pattern as ProfilePage.tsx (server's libphonenumber-js check
// remains the source of truth). logoUrl is a plain URL field here — no file
// upload pipeline exists yet.
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

function toFormValues(shop: { name: string; description?: string | null; address?: string | null; phone?: string | null; logoUrl?: string | null }): ShopProfileFormValues {
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
    <Card>
      <CardHeader>
        <CardTitle>Shop profile</CardTitle>
        <CardDescription>Update the public information customers see for your shop.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[minmax(0,420px)_1fr]">
        <form onSubmit={shopForm.handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="space-y-2">
            <Label htmlFor="shop-name">Shop name</Label>
            <Input id="shop-name" {...shopForm.register("name")} />
            {shopForm.formState.errors.name && (
              <p className="text-sm text-destructive">{shopForm.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="shop-description">Description</Label>
            <Textarea id="shop-description" {...shopForm.register("description")} />
            {shopForm.formState.errors.description && (
              <p className="text-sm text-destructive">{shopForm.formState.errors.description.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="shop-address">Address</Label>
            <Input id="shop-address" {...shopForm.register("address")} />
            {shopForm.formState.errors.address && (
              <p className="text-sm text-destructive">{shopForm.formState.errors.address.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="shop-phone">Phone</Label>
            <Input id="shop-phone" {...shopForm.register("phone")} />
            {shopForm.formState.errors.phone && (
              <p className="text-sm text-destructive">{shopForm.formState.errors.phone.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="shop-logo-url">Logo URL</Label>
            <Input id="shop-logo-url" {...shopForm.register("logoUrl")} />
            {shopForm.formState.errors.logoUrl && (
              <p className="text-sm text-destructive">{shopForm.formState.errors.logoUrl.message}</p>
            )}
          </div>
          <Button type="submit" disabled={shopMutation.isPending}>
            Save shop profile
          </Button>
          {shopMutation.error && <Alert variant="destructive">{getApiMessage(shopMutation.error)}</Alert>}
        </form>
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-medium">Shop summary</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Status: {shopQuery.data.status}</p>
            <p>Owner: {session.user.name}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
