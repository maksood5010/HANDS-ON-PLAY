import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  createUserHandler,
  deleteUserHandler,
  listUsersHandler,
  updateUserHandler,
} from "../controllers/userController.js";

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

router.get("/users", listUsersHandler);
router.post("/users", createUserHandler);
router.put("/users/:id", updateUserHandler);
router.delete("/users/:id", deleteUserHandler);

export default router;

