import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { formatMoney, getApiMessage } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import { CAR_TYPES } from "@/features/cars/constants";
import type { Car } from "@/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CURRENT_YEAR = new Date().getFullYear() + 1;

const imageUrlSchema = z
  .string()
  .trim()
  .url("Image URL must be a valid URL");

const imageUrlsArraySchema = z
  .array(imageUrlSchema)
  .max(10);

const inventoryFormSchema = z
  .object({
    brandId: z
      .string()
      .trim()
      .min(1, "Brand is required"),
    type: z.enum(CAR_TYPES),
    model: z
      .string()
      .trim()
      .min(1, "Model is required")
      .max(100),
    year: z.coerce
      .number()
      .int()
      .min(1990)
      .max(CURRENT_YEAR),
    pricePerDay: z.coerce
      .number()
      .positive("Price per day must be greater than 0"),
    minRentalDays: z.coerce
      .number()
      .int()
      .min(1),
    extraFees: z.coerce
      .number()
      .min(0),
    description: z
      .string()
      .trim()
      .max(2000),
    isBookableOnline: z.boolean(),
    imageUrls: z.string(),
  })
  .superRefine((data, ctx) => {
    const urls = data.imageUrls
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const result = imageUrlsArraySchema.safeParse(urls);

    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageUrls"],
        message:
          result.error.issues[0]?.message ??
          "Invalid image URLs",
      });
    }
  });

type InventoryFormValues = z.infer<
  typeof inventoryFormSchema
>;

const INITIAL_INVENTORY_VALUES: InventoryFormValues = {
  brandId: "",
  type: "SUV",
  model: "",
  year: new Date().getFullYear(),
  pricePerDay: 90,
  minRentalDays: 1,
  extraFees: 0,
  description: "",
  isBookableOnline: true,
  imageUrls: "",
};

function getImageUrls(values: InventoryFormValues) {
  return values.imageUrls
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function carToFormValues(
  car: Car,
): InventoryFormValues {
  return {
    brandId: car.brandId,
    type: car.type as InventoryFormValues["type"],
    model: car.model,
    year: car.year,
    pricePerDay: car.pricePerDay,
    minRentalDays: car.minRentalDays,
    extraFees: car.extraFees ?? 0,
    description: car.description ?? "",
    isBookableOnline: car.isBookableOnline,
    imageUrls: car.images
      .map((image) => image.url)
      .join("\n"),
  };
}

export function InventoryPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const [editingCarId, setEditingCarId] =
    useState<string | null>(null);

  const isEditing = editingCarId !== null;

  const inventoryForm =
    useForm<InventoryFormValues>({
      resolver: zodResolver(inventoryFormSchema),
      defaultValues: INITIAL_INVENTORY_VALUES,
    });

  const brandsQuery = useQuery({
    queryKey: ["brands"],
    queryFn: async () =>
      (await api.listCarBrands()).brands,
  });

  const inventoryQuery = useQuery({
    queryKey: [
      "inventory",
      session.user?.shop?.id,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        shopId: session.user!.shop!.id,
        page: "1",
        limit: "20",
      });

      return api.listCars(params);
    },
    enabled: Boolean(
      session.user?.role === "ADMIN" &&
        session.user.shop?.id,
    ),
  });

  function invalidateCarQueries() {
    void queryClient.invalidateQueries({
      queryKey: ["inventory"],
    });

    void queryClient.invalidateQueries({
      queryKey: ["cars"],
    });
  }

  function resetForm() {
    setEditingCarId(null);
    inventoryForm.reset(INITIAL_INVENTORY_VALUES);
  }

  const createCarMutation = useMutation({
    mutationFn: async (
      values: InventoryFormValues,
    ) =>
      api.createCar(session.token!, {
        brandId: values.brandId,
        type: values.type,
        model: values.model,
        year: values.year,
        pricePerDay: values.pricePerDay,
        minRentalDays: values.minRentalDays,
        extraFees:
          values.extraFees === 0
            ? undefined
            : values.extraFees,
        description:
          values.description || undefined,
        isBookableOnline:
          values.isBookableOnline,
        imageUrls: getImageUrls(values),
      }),

    onSuccess: (_result, values) => {
      inventoryForm.reset({
        ...INITIAL_INVENTORY_VALUES,
        brandId: values.brandId,
      });

      invalidateCarQueries();
    },
  });

  const updateCarMutation = useMutation({
    mutationFn: async ({
      carId,
      values,
    }: {
      carId: string;
      values: InventoryFormValues;
    }) =>
      api.updateCar(
        session.token!,
        carId,
        {
          brandId: values.brandId,
          type: values.type,
          model: values.model,
          year: values.year,
          pricePerDay: values.pricePerDay,
          minRentalDays: values.minRentalDays,
          extraFees: values.extraFees,
          description:
            values.description || null,
          isBookableOnline:
            values.isBookableOnline,
          imageUrls: getImageUrls(values),
        },
      ),

    onSuccess: () => {
      resetForm();
      invalidateCarQueries();
    },
  });

  const archiveCarMutation = useMutation({
    mutationFn: async (carId: string) =>
      api.archiveCar(session.token!, carId),

    onSuccess: (_result, archivedCarId) => {
      if (editingCarId === archivedCarId) {
        resetForm();
      }

      invalidateCarQueries();
    },
  });

  function startEditing(car: Car) {
    setEditingCarId(car.id);
    inventoryForm.reset(carToFormValues(car));

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEditing() {
    resetForm();
  }

  function archiveCar(car: Car) {
    const confirmed = window.confirm(
      `Archive ${car.brand.name} ${car.model}? It will be removed from public browsing.`,
    );

    if (confirmed) {
      archiveCarMutation.mutate(car.id);
    }
  }

  function onSubmit(
    values: InventoryFormValues,
  ) {
    if (editingCarId) {
      updateCarMutation.mutate({
        carId: editingCarId,
        values,
      });

      return;
    }

    createCarMutation.mutate(values);
  }

  const activeMutationError =
    createCarMutation.error ??
    updateCarMutation.error;

  const isSaving =
    createCarMutation.isPending ||
    updateCarMutation.isPending;

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>
            {isEditing
              ? "Edit car"
              : "Add inventory"}
          </CardTitle>

          <CardDescription>
            {isEditing
              ? "Update the selected car listing."
              : "Create a car listing for your shop using the live admin API."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={inventoryForm.handleSubmit(
              onSubmit,
            )}
            className="space-y-3"
            noValidate
          >
            <Select
              aria-label="Brand"
              {...inventoryForm.register(
                "brandId",
              )}
            >
              <option value="">
                Select brand
              </option>

              {(brandsQuery.data ?? []).map(
                (brand) => (
                  <option
                    key={brand.id}
                    value={brand.id}
                  >
                    {brand.name}
                  </option>
                ),
              )}
            </Select>

            {inventoryForm.formState.errors
              .brandId && (
              <p className="text-sm text-destructive">
                {
                  inventoryForm.formState.errors
                    .brandId.message
                }
              </p>
            )}

            <Select
              aria-label="Car type"
              {...inventoryForm.register("type")}
            >
              {CAR_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ))}
            </Select>

            <Input
              placeholder="Model"
              {...inventoryForm.register("model")}
            />

            {inventoryForm.formState.errors
              .model && (
              <p className="text-sm text-destructive">
                {
                  inventoryForm.formState.errors
                    .model.message
                }
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Input
                  type="number"
                  placeholder="Year"
                  {...inventoryForm.register(
                    "year",
                  )}
                />

                {inventoryForm.formState.errors
                  .year && (
                  <p className="text-sm text-destructive">
                    {
                      inventoryForm.formState
                        .errors.year.message
                    }
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Input
                  type="number"
                  placeholder="Price/day"
                  {...inventoryForm.register(
                    "pricePerDay",
                  )}
                />

                {inventoryForm.formState.errors
                  .pricePerDay && (
                  <p className="text-sm text-destructive">
                    {
                      inventoryForm.formState
                        .errors.pricePerDay
                        .message
                    }
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Input
                  type="number"
                  placeholder="Minimum rental days"
                  {...inventoryForm.register(
                    "minRentalDays",
                  )}
                />

                {inventoryForm.formState.errors
                  .minRentalDays && (
                  <p className="text-sm text-destructive">
                    {
                      inventoryForm.formState
                        .errors.minRentalDays
                        .message
                    }
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Input
                  type="number"
                  placeholder="Extra fees"
                  {...inventoryForm.register(
                    "extraFees",
                  )}
                />

                {inventoryForm.formState.errors
                  .extraFees && (
                  <p className="text-sm text-destructive">
                    {
                      inventoryForm.formState
                        .errors.extraFees.message
                    }
                  </p>
                )}
              </div>
            </div>

            <Textarea
              placeholder="Description"
              {...inventoryForm.register(
                "description",
              )}
            />

            {inventoryForm.formState.errors
              .description && (
              <p className="text-sm text-destructive">
                {
                  inventoryForm.formState.errors
                    .description.message
                }
              </p>
            )}

            <Textarea
              placeholder="Image URLs, one per line"
              {...inventoryForm.register(
                "imageUrls",
              )}
            />

            {inventoryForm.formState.errors
              .imageUrls && (
              <p className="text-sm text-destructive">
                {
                  inventoryForm.formState.errors
                    .imageUrls.message
                }
              </p>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                {...inventoryForm.register(
                  "isBookableOnline",
                )}
              />

              Available for online booking
            </label>

            <Button
              className="w-full"
              type="submit"
              disabled={isSaving}
            >
              {isSaving
                ? "Saving..."
                : isEditing
                  ? "Save changes"
                  : "Add car"}
            </Button>

            {isEditing && (
              <Button
                className="w-full"
                type="button"
                variant="outline"
                onClick={cancelEditing}
                disabled={isSaving}
              >
                Cancel editing
              </Button>
            )}

            {activeMutationError && (
              <Alert variant="destructive">
                {getApiMessage(
                  activeMutationError,
                )}
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Your inventory
          </CardTitle>

          <CardDescription>
            Manage your shop’s active car
            listings.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {inventoryQuery.isLoading && (
            <p className="text-sm text-muted-foreground">
              Loading inventory...
            </p>
          )}

          {inventoryQuery.error && (
            <Alert variant="destructive">
              {getApiMessage(
                inventoryQuery.error,
              )}
            </Alert>
          )}

          {!inventoryQuery.isLoading &&
            !inventoryQuery.error &&
            (inventoryQuery.data?.items
              .length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                Your shop does not have any
                active cars yet.
              </p>
            )}

          {(inventoryQuery.data?.items ??
            []).map((car) => (
            <div
              key={car.id}
              className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">
                  {car.brand.name}{" "}
                  {car.model}
                </p>

                <p className="text-sm text-muted-foreground">
                  {car.type} •{" "}
                  {formatMoney(
                    car.pricePerDay,
                  )}
                  /day
                </p>

                <p className="text-xs text-muted-foreground">
                  {car.year} • Minimum{" "}
                  {car.minRentalDays} day
                  {car.minRentalDays === 1
                    ? ""
                    : "s"}{" "}
                  •{" "}
                  {car.isBookableOnline
                    ? "Online booking enabled"
                    : "Online booking disabled"}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() =>
                    startEditing(car)
                  }
                  disabled={
                    archiveCarMutation.isPending
                  }
                >
                  Edit
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() =>
                    archiveCar(car)
                  }
                  disabled={
                    archiveCarMutation.isPending
                  }
                >
                  Archive
                </Button>
              </div>
            </div>
          ))}

          {archiveCarMutation.error && (
            <Alert variant="destructive">
              {getApiMessage(
                archiveCarMutation.error,
              )}
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}