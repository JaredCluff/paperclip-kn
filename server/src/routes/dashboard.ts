import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { dashboardService } from "../services/dashboard.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

export function dashboardRoutes(db: Db) {
  const router = Router();
  const svc = dashboardService(db);

  router.get("/companies/:companyId/dashboard", async (req, res) => {
    const companyId = req.params.companyId as string;
    // Dashboard exposes company-wide metrics; restrict to board members only.
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const summary = await svc.summary(companyId);
    res.json(summary);
  });

  return router;
}
