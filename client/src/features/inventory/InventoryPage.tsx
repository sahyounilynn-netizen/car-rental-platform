import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatMoney, getApiMessage } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import { CAR_TYPES } from "@/features/cars/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const INITIAL_INVENTORY_DRAFT = {
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

export function InventoryPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [inventoryDraft, setInventoryDraft] = useState(INITIAL_INVENTORY_DRAFT);

  const brandsQuery = useQuery({
    queryKey: ["brands"],
    queryFn: async () => (await api.listCarBrands()).brands,
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", session.user?.shop?.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        shopId: session.user!.shop!.id,
        page: "1",
        limit: "20",
      });
      return api.listCars(params);
    },
    enabled: Boolean(session.user?.role === "ADMIN" && session.user.shop?.id),
  });

  const createCarMutation = useMutation({
    mutationFn: async () =>
      api.createCar(session.token!, {
        brandId: inventoryDraft.brandId,
        type: inventoryDraft.type,
        model: inventoryDraft.model,
        year: Number(inventoryDraft.year),
        pricePerDay: Number(inventoryDraft.pricePerDay),
        minRentalDays: Number(inventoryDraft.minRentalDays),
        extraFees: Number(inventoryDraft.extraFees) || undefined,
        description: inventoryDraft.description || undefined,
        isBookableOnline: inventoryDraft.isBookableOnline,
        imageUrls: inventoryDraft.imageUrls
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setInventoryDraft({
        ...INITIAL_INVENTORY_DRAFT,
        brandId: inventoryDraft.brandId,
      });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["cars"] });
    },
  });

  const archiveCarMutation = useMutation({
    mutationFn: async (carId: string) => api.archiveCar(session.token!, carId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["cars"] });
    },
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Add inventory</CardTitle>
          <CardDescription>Create a car listing for your shop using the live admin API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={inventoryDraft.brandId}
            onChange={(event) => setInventoryDraft({ ...inventoryDraft, brandId: event.target.value })}
          >
            <option value="">Select brand</option>
            {(brandsQuery.data ?? []).map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
          <Select value={inventoryDraft.type} onChange={(event) => setInventoryDraft({ ...inventoryDraft, type: event.target.value })}>
            {CAR_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Model"
            value={inventoryDraft.model}
            onChange={(event) => setInventoryDraft({ ...inventoryDraft, model: event.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              placeholder="Year"
              value={String(inventoryDraft.year)}
              onChange={(event) =>
                setInventoryDraft({ ...inventoryDraft, year: Number(event.target.value) })
              }
            />
            <Input
              type="number"
              placeholder="Price/day"
              value={String(inventoryDraft.pricePerDay)}
              onChange={(event) =>
                setInventoryDraft({ ...inventoryDraft, pricePerDay: Number(event.target.value) })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              placeholder="Minimum rental days"
              value={String(inventoryDraft.minRentalDays)}
              onChange={(event) =>
                setInventoryDraft({ ...inventoryDraft, minRentalDays: Number(event.target.value) })
              }
            />
            <Input
              type="number"
              placeholder="Extra fees"
              value={String(inventoryDraft.extraFees)}
              onChange={(event) =>
                setInventoryDraft({ ...inventoryDraft, extraFees: Number(event.target.value) })
              }
            />
          </div>
          <Textarea
            placeholder="Description"
            value={inventoryDraft.description}
            onChange={(event) => setInventoryDraft({ ...inventoryDraft, description: event.target.value })}
          />
          <Textarea
            placeholder="Image URLs, one per line"
            value={inventoryDraft.imageUrls}
            onChange={(event) => setInventoryDraft({ ...inventoryDraft, imageUrls: event.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inventoryDraft.isBookableOnline}
              onChange={(event) =>
                setInventoryDraft({ ...inventoryDraft, isBookableOnline: event.target.checked })
              }
            />
            Available for online booking
          </label>
          <Button
            className="w-full"
            onClick={() => createCarMutation.mutate()}
            disabled={createCarMutation.isPending || !inventoryDraft.brandId || !inventoryDraft.model}
          >
            Add car
          </Button>
          {createCarMutation.error && (
            <p className="text-sm text-destructive">{getApiMessage(createCarMutation.error)}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your inventory</CardTitle>
          <CardDescription>Active public listings for your shop.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(inventoryQuery.data?.items ?? []).map((car) => (
            <div key={car.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {car.brand.name} {car.model}
                </p>
                <p className="text-sm text-muted-foreground">
                  {car.type} • {formatMoney(car.pricePerDay)}/day
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => archiveCarMutation.mutate(car.id)}
                disabled={archiveCarMutation.isPending}
              >
                Archive
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
