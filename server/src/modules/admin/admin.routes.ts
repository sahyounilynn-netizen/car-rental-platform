import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middlewares/authenticate";
import { requireRole } from "../../middlewares/requireRole";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate";
import * as adminController from "./admin.controller";
import {
  adminAuditLogsQuerySchema,
  adminShopIdParamsSchema,
  adminShopsQuerySchema,
  adminUserIdParamsSchema,
  adminUsersQuerySchema,
  updateAdminShopStatusSchema,
  updateAdminUserStatusSchema,
} from "./admin.validators";

export const adminRouter = Router();

adminRouter.use(
  authenticate,
  requireRole("SUPERADMIN"),
);

adminRouter.get(
  "/summary",
  asyncHandler(
    adminController.getSummary,
  ),
);

adminRouter.get(
  "/users",
  validateQuery(adminUsersQuerySchema),
  asyncHandler(
    adminController.listUsers,
  ),
);

adminRouter.get(
  "/shops",
  validateQuery(adminShopsQuerySchema),
  asyncHandler(
    adminController.listShops,
  ),
);

adminRouter.get(
  "/audit-logs",
  validateQuery(
    adminAuditLogsQuerySchema,
  ),
  asyncHandler(
    adminController.listAuditLogs,
  ),
);

adminRouter.patch(
  "/users/:userId/status",
  validateParams(
    adminUserIdParamsSchema,
  ),
  validateBody(
    updateAdminUserStatusSchema,
  ),
  asyncHandler(
    adminController.updateUserStatus,
  ),
);

adminRouter.patch(
  "/shops/:shopId/status",
  validateParams(
    adminShopIdParamsSchema,
  ),
  validateBody(
    updateAdminShopStatusSchema,
  ),
  asyncHandler(
    adminController.updateShopStatus,
  ),
);