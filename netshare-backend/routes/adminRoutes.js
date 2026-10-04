import express from "express";
import {
  getAdminDashboard,
  getAllUsers,
  getAllNodes,
  getAllTasks,
  getAllTransactions,
  blockUser,
  unblockUser,
  getAdminLogs,
} from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/dashboard", protect, allowRoles("admin"), getAdminDashboard);
router.get("/users", protect, allowRoles("admin"), getAllUsers);
router.get("/nodes", protect, allowRoles("admin"), getAllNodes);
router.get("/tasks", protect, allowRoles("admin"), getAllTasks);
router.get("/transactions", protect, allowRoles("admin"), getAllTransactions);
router.put("/users/:id/block", protect, allowRoles("admin"), blockUser);
router.put("/users/:id/unblock", protect, allowRoles("admin"), unblockUser);
router.get("/logs", protect, allowRoles("admin"), getAdminLogs);

export default router;