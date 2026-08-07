import { prisma } from "../../lib/prisma";
import { toPublicUser } from "../../lib/sanitize";
import type { UpdateProfileInput } from "./users.validators";

export async function updateMe(userId: string, data: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    include: { shop: true },
  });
  return toPublicUser(user);
}
