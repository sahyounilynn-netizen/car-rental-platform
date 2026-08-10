import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { z } from "zod";
import { api } from "@/lib/api";
import { getApiMessage } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const authFormSchema = z
  .object({
    mode: z.enum(["login", "signup"]),
    name: z.string().trim(),
    email: z.string().trim().email("Invalid email address"),
    password: z.string(),
    phone: z.string().trim(),
    asShop: z.boolean(),
    shopName: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "login") {
      if (!data.password) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "Password is required" });
      }
      return;
    }

    if (data.name.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: "Name must be at least 2 characters" });
    }
    if (data.password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Password must be at least 8 characters",
      });
    } else {
      if (!/[a-z]/.test(data.password)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "Password must contain a lowercase letter",
        });
      }
      if (!/[A-Z]/.test(data.password)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "Password must contain an uppercase letter",
        });
      }
      if (!/[0-9]/.test(data.password)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "Password must contain a number",
        });
      }
    }
    if (data.asShop && data.shopName.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shopName"],
        message: "shopName is required when signing up as a shop",
      });
    }
  });

type AuthFormValues = z.infer<typeof authFormSchema>;

const INITIAL_AUTH_VALUES: AuthFormValues = {
  mode: "login",
  name: "",
  email: "",
  password: "",
  phone: "",
  asShop: false,
  shopName: "",
};

export function AuthPanel() {
  const { applySession } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: INITIAL_AUTH_VALUES,
  });
  const authMode = form.watch("mode");
  const asShop = form.watch("asShop");

  const authenticateMutation = useMutation({
    mutationFn: async (values: AuthFormValues) => {
      return values.mode === "login"
        ? api.login({
            email: values.email,
            password: values.password,
          })
        : api.signup({
            name: values.name,
            email: values.email,
            password: values.password,
            phone: values.phone || undefined,
            asShop: values.asShop,
            shopName: values.asShop ? values.shopName : undefined,
          });
    },
    onSuccess: (result, values) => {
      applySession(result);
      setAuthError(null);
      form.reset({ ...INITIAL_AUTH_VALUES, mode: values.mode });
      navigate("/");
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      setAuthError(getApiMessage(error));
    },
  });

  function onSubmit(values: AuthFormValues) {
    authenticateMutation.mutate(values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{authMode === "login" ? "Login" : "Create account"}</CardTitle>
        <CardDescription>
          {authMode === "login"
            ? "Sign in to save favorites, place bookings, or manage a shop."
            : "Create a customer or shop admin account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {authMode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          {authMode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...form.register("phone")} />
                {form.formState.errors.phone && (
                  <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register("asShop")} />
                Sign up as a shop admin
              </label>
              {asShop && (
                <div className="space-y-2">
                  <Label htmlFor="shopName">Shop name</Label>
                  <Input id="shopName" {...form.register("shopName")} />
                  {form.formState.errors.shopName && (
                    <p className="text-sm text-destructive">{form.formState.errors.shopName.message}</p>
                  )}
                </div>
              )}
            </>
          )}
          {authError && <Alert variant="destructive">{authError}</Alert>}
          <Button className="w-full" type="submit" disabled={authenticateMutation.isPending}>
            {authenticateMutation.isPending ? "Working..." : authMode === "login" ? "Login" : "Create account"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            type="button"
            onClick={() => {
              form.setValue("mode", authMode === "login" ? "signup" : "login");
              setAuthError(null);
            }}
          >
            {authMode === "login" ? "Need an account?" : "Already have an account?"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
