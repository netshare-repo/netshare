import express from "express";
import {
  getClientDashboard,
  createTask,
  getMyTasks,
  getTaskById,
  startTask,
  completeTask,
  failTask,
} from "../controllers/taskController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

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
  createTask
);

router.get(
  "/my-tasks",
  protect,
  allowRoles("platform_client", "both"),
  getMyTasks
);

router.get("/:id", protect, getTaskById);

router.put(
  "/:id/start",
  protect,
  allowRoles("node_participant", "both", "admin"),
  startTask
);

router.put(
  "/:id/complete",
  protect,
  allowRoles("node_participant", "both", "admin"),
  completeTask
);

router.put(
  "/:id/fail",
  protect,
  allowRoles("node_participant", "both", "admin"),
  failTask
);

export default router;