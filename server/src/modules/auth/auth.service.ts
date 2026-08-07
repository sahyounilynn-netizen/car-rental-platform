import { randomUUID } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { hashPassword, comparePassword } from "../../lib/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { sha256 } from "../../lib/hash";
import { expiryDateFromNow } from "../../lib/duration";
import { env } from "../../config/env";
import { toPublicUser } from "../../lib/sanitize";
import { UnauthorizedError, ForbiddenError } from "../../lib/errors";
import type { SignupInput, LoginInput } from "./auth.validators";

async function issueTokenPair(user: { id: string; role: Role }, shopId?: string) {
  const tokenId = randomUUID();
  const accessToken = signAccessToken({ sub: user.id, role: user.role, shopId });
  const refreshToken = signRefreshToken({ sub: user.id, jti: tokenId });

  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: expiryDateFromNow(env.JWT_REFRESH_EXPIRES_IN),
    },
  });

  return { accessToken, refreshToken, refreshTokenId: tokenId };
}

export async function signup(input: SignupInput) {
  const passwordHash = await hashPassword(input.password);

  const { user, shop } = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: input.asShop ? "ADMIN" : "USER",
      },
    });

    const createdShop = input.asShop
      ? await tx.shop.create({ data: { ownerId: createdUser.id, name: input.shopName! } })
      : null;

    return { user: createdUser, shop: createdShop };
  });

  const tokens = await issueTokenPair(user, shop?.id);

  return {
    user: { ...toPublicUser(user), shop },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { shop: true },
  });
  if (!user) throw new UnauthorizedError("Invalid email or password");

  const validPassword = await comparePassword(input.password, user.passwordHash);
  if (!validPassword) throw new UnauthorizedError("Invalid email or password");

  if (user.status === "SUSPENDED") {
    throw new ForbiddenError("This account has been suspended");
  }

  const tokens = await issueTokenPair(user, user.shop?.id);

  return {
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function refresh(rawToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const tokenHash = sha256(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });

  if (!existing || existing.tokenHash !== tokenHash) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  if (existing.revokedAt || existing.expiresAt < new Date()) {
    // A revoked-or-expired token being presented again looks like theft/replay:
    // kill every active session for this user, not just this one.
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError("Session expired, please log in again");
  }

  const user = await prisma.user.findUnique({
    where: { id: existing.userId },
    include: { shop: true },
  });
  if (!user || user.status === "SUSPENDED") {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const tokens = await issueTokenPair(user, user.shop?.id);

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedByTokenId: tokens.refreshTokenId },
  });

  return {
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function logout(rawToken?: string) {
  if (!rawToken) return;

  try {
    const payload = verifyRefreshToken(rawToken);
    await prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Already invalid/expired — logout is a no-op in that case.
  }
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { shop: true },
  });
  if (!user) throw new UnauthorizedError();
  return toPublicUser(user);
}
