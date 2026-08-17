import type { Prisma } from "@prisma/client";

type AuditClient = Pick<
  Prisma.TransactionClient,
  "auditLog"
>;

export interface AuditLogInput {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
}

export async function createAuditLog(
  client: AuditClient,
  input: AuditLogInput,
) {
  return client.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      ...(input.metadata !== undefined
        ? {
            metadata: input.metadata,
          }
        : {}),
    },
  });
}