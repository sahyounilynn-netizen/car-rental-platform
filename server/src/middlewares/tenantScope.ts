import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

/**
 * Injects req.shopId from the authenticated admin's own JWT claim.
 * Must run after `authenticate` and `requireRole("ADMIN")`. Never trusts a
 * shopId supplied by the client (body/params/query) for write operations —
 * services must always use req.shopId, and re-verify ownership on mutations.
 */
export function tenantScope(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }
  if (req.user.role !== "ADMIN") {
    next(new ForbiddenError("This action is only available to shop admins"));
    return;
  }
  if (!req.user.shopId) {
    next(new ForbiddenError("No shop is associated with this account"));
    return;
  }
  req.shopId = req.user.shopId;
  next();
}
