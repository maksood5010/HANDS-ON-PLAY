import express from "express";
import { authenticate, requirePlatformSuperAdmin } from "../middleware/auth.js";
import companyLogoUpload from "../middleware/companyLogoUpload.js";
import {
  createCompanyHandler,
  deleteCompanyHandler,
  getCompanyAdminHandler,
  getCompanyHandler,
  listCompaniesHandler,
  resetCompanyAdminPasswordHandler,
  updateCompanyHandler,
} from "../controllers/companyController.js";

const router = express.Router();

router.use(authenticate);
router.use(requirePlatformSuperAdmin);

router.get("/companies", listCompaniesHandler);
router.post("/companies", companyLogoUpload.single("logo"), createCompanyHandler);
router.get("/companies/:id", getCompanyHandler);
router.get("/companies/:id/admin", getCompanyAdminHandler);
router.post("/companies/:id/admin/reset-password", resetCompanyAdminPasswordHandler);
router.put("/companies/:id", companyLogoUpload.single("logo"), updateCompanyHandler);
router.delete("/companies/:id", deleteCompanyHandler);

export default router;

