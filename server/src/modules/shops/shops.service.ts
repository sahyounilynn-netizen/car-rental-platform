import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import type { UpdateShopInput } from "./shops.validators";

export async function getMyShop(shopId: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    throw new NotFoundError("Shop not found");
  }
  return shop;
}

export async function updateMyShop(shopId: string, input: UpdateShopInput) {
  await getMyShop(shopId);

  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "description")
        ? { description: input.description }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "address") ? { address: input.address } : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "phone") ? { phone: input.phone } : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "logoUrl") ? { logoUrl: input.logoUrl } : {}),
    },
  });

  return shop;
}
