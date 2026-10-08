import express from "express";
import {
  getClientDashboard,
  createTask,
  getMyTasks,
  getTaskById,
  startTask,
  completeTask,
  failTask,
  estimateTaskCost,
  downloadTaskReport,
  rateTaskNode,
} from "../controllers/taskController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateTaskSubmission } from "../middleware/securityMiddleware.js";
import { developmentOnly } from '../middleware/productionGuard.js';

const router = express.Router();

router.get(
  "/client/dashboard",
  protect,
  allowRoles("platform_client", "both"),
  getClientDashboard
);

router.post(
  "/",
  protect,
  allowRoles("platform_client", "both"),
  validateTaskSubmission,
  createTask
);

router.post(
  "/estimate",
  protect,
  allowRoles("platform_client", "both"),
  estimateTaskCost
);

router.get(
  "/my-tasks",
  protect,
  allowRoles("platform_client", "both"),
  getMyTasks
);

router.get("/:id/report.csv", protect, downloadTaskReport);

router.post(
  "/:id/rating",
  protect,
  allowRoles("platform_client", "both"),
  rateTaskNode
);

router.get("/:id", protect, getTaskById);

router.put(
  "/:id/start",
  developmentOnly,
  protect,
  allowRoles("node_participant", "both", "admin"),
  startTask
);

router.put(
  "/:id/complete",
  developmentOnly,
  protect,
  allowRoles("node_participant", "both", "admin"),
  completeTask
);

router.put(
  "/:id/fail",
  developmentOnly,
  protect,
  allowRoles("node_participant", "both", "admin"),
  failTask
);

export default router;
