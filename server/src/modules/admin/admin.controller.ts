import type {
  Request,
  Response,
} from "express";
import * as adminService from "./admin.service";
import type {
  AdminAuditLogsQuery,
  AdminShopsQuery,
  AdminUsersQuery,
  UpdateAdminShopStatusInput,
  UpdateAdminUserStatusInput,
} from "./admin.validators";

export async function getSummary(
  _req: Request,
  res: Response,
) {
  const summary =
    await adminService.getSummary();

  res.status(200).json({ summary });
}

export async function listUsers(
  req: Request,
  res: Response,
) {
  const users =
    await adminService.listUsers(
      req.query as unknown as AdminUsersQuery,
    );

  res.status(200).json(users);
}

export async function listShops(
  req: Request,
  res: Response,
) {
  const shops =
    await adminService.listShops(
      req.query as unknown as AdminShopsQuery,
    );

  res.status(200).json(shops);
}

export async function listAuditLogs(
  req: Request,
  res: Response,
) {
  const logs =
    await adminService.listAuditLogs(
      req.query as unknown as AdminAuditLogsQuery,
    );

  res.status(200).json(logs);
}

export async function updateUserStatus(
  req: Request,
  res: Response,
) {
  const user =
    await adminService.updateUserStatus(
      req.user!.id,
      req.params.userId!,
      req.body as UpdateAdminUserStatusInput,
    );

  res.status(200).json({ user });
}

export async function updateShopStatus(
  req: Request,
  res: Response,
) {
  const shop =
    await adminService.updateShopStatus(
      req.user!.id,
      req.params.shopId!,
      req.body as UpdateAdminShopStatusInput,
    );

  res.status(200).json({ shop });
}