import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { requireRole } from "../requireRole";
import { tenantScope } from "../tenantScope";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors";

function mockReq(user?: Request["user"]): Request {
  return { user } as Request;
}

describe("requireRole", () => {
  it("calls next with UnauthorizedError when there is no user", () => {
    const next = vi.fn();
    requireRole("ADMIN")(mockReq(undefined), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("calls next with ForbiddenError when the role is not allowed", () => {
    const next = vi.fn();
    requireRole("ADMIN", "SUPERADMIN")(mockReq({ id: "u1", role: "USER" }), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("calls next() with no error when the role is allowed", () => {
    const next = vi.fn();
    requireRole("ADMIN")(mockReq({ id: "u1", role: "ADMIN" }), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("tenantScope", () => {
  it("rejects unauthenticated requests", () => {
    const next = vi.fn();
    tenantScope(mockReq(undefined), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("rejects non-ADMIN roles even if authenticated", () => {
    const next = vi.fn();
    const req = mockReq({ id: "u1", role: "USER" });
    tenantScope(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("rejects an ADMIN with no shopId on their token", () => {
    const next = vi.fn();
    const req = mockReq({ id: "u1", role: "ADMIN" });
    tenantScope(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("injects req.shopId from the admin's own token, never from the client", () => {
    const next = vi.fn();
    const req = mockReq({ id: "u1", role: "ADMIN", shopId: "shop-1" });
    tenantScope(req, {} as Response, next);
    expect(req.shopId).toBe("shop-1");
    expect(next).toHaveBeenCalledWith();
  });
});
